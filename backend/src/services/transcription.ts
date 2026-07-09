import { eq, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '../db/client.js'
import { actionItems, jobs, users, type JobStatus, type TranscriptPayload, type TranscriptSegment } from '../db/schema.js'
import { transcribeAudio, polishTranscript, generateInsights } from './deepgram.js'
import { cacheJobStatus, invalidateUserStats } from './cache.js'
import { readObject } from './storage.js'
import { sendTaskNotification } from './email.js'

const PROGRESS_BY_STEP: Record<string, number> = {
  'Transcribing audio...': 35,
  'Processing speaker labels...': 65,
  'Refining transcript...': 75,
  'Generating summary...': 85,
}

function stepProgress(step: string): number {
  const exact = PROGRESS_BY_STEP[step]
  if (exact) return exact
  // Match chunk progress like "Transcribing chunk 1/8..."
  const chunkMatch = step.match(/Transcribing chunk (\d+)\/(\d+)/)
  if (chunkMatch) {
    const current = Number(chunkMatch[1])
    const total = Number(chunkMatch[2])
    // Map chunk progress to range 35-65
    return 35 + Math.round((current / total) * 30)
  }
  return 50
}

export async function processStoredTranscriptionJob(jobId: string): Promise<void> {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1)
  if (!job) throw new Error(`Job ${jobId} not found`)
  if (job.status === 'cancelled') return
  if (!job.storageKey) throw new Error(`Job ${jobId} missing storage key`)

  try {
    await cacheJobStatus(jobId, { status: 'transcribing', progress: 30 })
    const buffer = await readObject(job.storageKey)

    // Phase 1: Deepgram transcription only (fast, no GLM)
    const { segments, detectedLanguage, durationSec: actualDuration } = await transcribeAudio({
      buffer,
      mimeType: job.mimeType,
      language: job.language as 'id' | 'en' | 'auto',
      onProgress: async (step) => {
        console.log(`[${jobId}] ${step}`)
        await cacheJobStatus(jobId, {
          status: 'transcribing',
          progress: stepProgress(step),
        })
      },
    })

    const [current] = await db
      .select({ status: jobs.status, durationSec: jobs.durationSec })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1)

    if (!current || current.status === 'cancelled') {
      console.log(`[${jobId}] Job cancelled before completion; skipping save and credit reconciliation`)
      return
    }

    const uniqueSpeakers = new Set(segments.map((s) => s.speaker))

    function normalizeLang(lang: string | undefined): 'id' | 'en' | 'mixed' {
      if (lang === 'id' || lang === 'en') return lang
      if (lang?.startsWith('id')) return 'id'
      if (lang?.startsWith('en')) return 'en'
      return 'mixed'
    }

    // Save raw transcript immediately so user can see results
    const rawPayload: TranscriptPayload = {
      segments,
      rawSegments: undefined,
      polished: false,
      speakerCount: uniqueSpeakers.size,
      summary: '',
      language: job.language === 'auto' ? normalizeLang(detectedLanguage) : job.language as 'id' | 'en' | 'mixed',
    }

    await db
      .update(jobs)
      .set({
        status: 'completed' satisfies JobStatus,
        transcript: rawPayload,
        durationSec: actualDuration,
        completedAt: new Date(),
        errorMessage: null,
      })
      .where(eq(jobs.id, jobId))

    await reconcileReservedCredits(jobId, job.userId, current.durationSec ?? actualDuration, actualDuration)
    await cacheJobStatus(jobId, { status: 'completed', progress: 70 })
    await invalidateUserStats(job.userId)

    // Phase 2: Background processing
    void (async () => {
      try {
        // Step 1: Generate title, summary, action items FIRST (uses raw segments)
        console.log(`[${jobId}] Background: Generating summary...`)
        await cacheJobStatus(jobId, { status: 'completed', progress: 80 })
        const insights = await generateInsights(segments)

        const updatedSpeakers = new Set(segments.map((s) => s.speaker))

        await db
          .update(jobs)
          .set({
            transcript: {
              segments,
              rawSegments: undefined,
              polished: false,
              speakerCount: updatedSpeakers.size,
              summary: insights.summary,
              language: rawPayload.language,
            },
            title: insights.title || null,
          })
          .where(eq(jobs.id, jobId))

        if (insights.actionItems.length > 0) {
          await db
            .insert(actionItems)
            .values(
              insights.actionItems.map((it, i) => ({
                id: nanoid(),
                jobId,
                owner: it.owner,
                task: it.task,
                due: it.due ?? null,
                confidence: it.confidence,
                order: i,
              }))
            )
            .catch((err) => console.warn(`[${jobId}] Failed to persist action items:`, err))

          const meetingTitle = job.title || job.filename.replace(/\.[^/.]+$/, '')
          for (const item of insights.actionItems) {
            const matchName = item.owner.trim().toLowerCase()
            const [user] = await db
              .select({ email: users.email, displayName: users.displayName, ccEmails: users.ccEmails })
              .from(users)
              .where(sql`LOWER(COALESCE(${users.displayName}, ${users.username})) = ${matchName}`)
              .limit(1)
            if (user?.email) {
              sendTaskNotification({
                to: user.email,
                taskTitle: item.task,
                meetingTitle,
                assigneeName: user.displayName ?? item.owner,
              }).catch((err) => console.warn(`[${jobId}] Email send failed for ${item.owner}:`, err))
              const ccList = (user.ccEmails ?? []) as string[]
              for (const cc of ccList) {
                if (cc !== user.email) {
                  sendTaskNotification({
                    to: cc,
                    taskTitle: item.task,
                    meetingTitle,
                    assigneeName: user.displayName ?? item.owner,
                  }).catch(() => {})
                }
              }
            }
          }
        }

        // Step 2: Polish transcript (refine segment text) in background
        if (segments.length > 0) {
          console.log(`[${jobId}] Background: Refining transcript...`)
          await cacheJobStatus(jobId, { status: 'completed', progress: 90 })
          try {
            const r = await polishTranscript(segments)
            const polishedSegments = r.polished
            const rawSegments = r.raw
            console.log(`[${jobId}] Background: Polish pass done (${rawSegments.length} -> ${polishedSegments.length} segments)`)

            const finalSpeakers = new Set(polishedSegments.map((s) => s.speaker))

            await db
              .update(jobs)
              .set({
                transcript: {
                  segments: polishedSegments,
                  rawSegments,
                  polished: true,
                  speakerCount: finalSpeakers.size,
                  summary: insights.summary,
                  language: rawPayload.language,
                },
              })
              .where(eq(jobs.id, jobId))
          } catch (err) {
            console.warn(`[${jobId}] Background polish failed, keeping raw:`, err)
          }
        }

        await cacheJobStatus(jobId, { status: 'completed', progress: 100 })
        console.log(`[${jobId}] Background: Processing complete`)
      } catch (err) {
        const bgMsg = err instanceof Error ? err.message : String(err)
        console.error(`[${jobId}] Background processing failed:`, bgMsg)
        await db
          .update(jobs)
          .set({ errorMessage: `Peringatan: ${bgMsg}` })
          .where(eq(jobs.id, jobId))
      }
    })()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[${jobId}] Transcription failed`, err)

    const [current] = await db
      .select({ status: jobs.status })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .limit(1)

    if (!current || current.status === 'cancelled') return

    await Promise.all([
      db
        .update(jobs)
        .set({ status: 'failed' satisfies JobStatus, errorMessage: msg })
        .where(eq(jobs.id, jobId)),
      refundReservedCredits(jobId, job.userId),
      cacheJobStatus(jobId, { status: 'failed', error: msg }),
    ])
  }
}

async function reconcileReservedCredits(
  jobId: string,
  userId: string,
  estimatedDuration: number,
  actualDuration: number
): Promise<void> {
  const delta = actualDuration - estimatedDuration
  if (delta < 0) {
    await db
      .update(users)
      .set({ creditSeconds: sql`${users.creditSeconds} + ${Math.abs(delta)}` })
      .where(eq(users.id, userId))
  } else if (delta > 0) {
    await db
      .update(users)
      .set({ creditSeconds: sql`GREATEST(${users.creditSeconds} - ${delta}, 0)` })
      .where(eq(users.id, userId))
  }
}

async function refundReservedCredits(jobId: string, userId: string): Promise<void> {
  const [job] = await db
    .select({ durationSec: jobs.durationSec, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1)

  if (!job || job.status === 'cancelled' || !job.durationSec || job.durationSec <= 0) return

  await db
    .update(users)
    .set({ creditSeconds: sql`${users.creditSeconds} + ${job.durationSec}` })
    .where(eq(users.id, userId))
}
