import { Hono } from 'hono'
import { and, eq, sql, desc } from 'drizzle-orm'
import { db } from '../db/client.js'
import { jobs } from '../db/schema.js'
import { requireAuth, type AppEnv } from '../middleware/auth.js'

export const searchRouter = new Hono<AppEnv>()

searchRouter.get('/', requireAuth, async (c) => {
  const user = c.get('user')
  const q = c.req.query('q')?.trim()
  if (!q || q.length < 2) return c.json({ results: [] })
  if (q.length > 100) return c.json({ error: 'Pencarian maksimal 100 karakter' }, 400)

  const like = `%${q}%`

  interface JobRow {
    id: string
    filename: string
    title: string | null
    createdAt: Date
    completedAt: Date | null
    durationSec: number | null
    transcript: {
      segments?: Array<{ speaker: string; text: string; start: string; end: string }>
    } | null
  }

  const rows = await db
    .select({
      id: jobs.id,
      filename: jobs.filename,
      title: jobs.title,
      createdAt: jobs.createdAt,
      completedAt: jobs.completedAt,
      durationSec: jobs.durationSec,
      transcript: jobs.transcript,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.userId, user.id),
        eq(jobs.status, 'completed'),
        sql`${jobs.transcript}::text ILIKE ${like}`
      )
    )
    .orderBy(desc(jobs.createdAt))
    .limit(50)

  const results = rows.map((r) => {
    const segments = (r as unknown as JobRow).transcript?.segments ?? []
    const matches = segments
      .filter((s: { text: string }) => s.text.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 10)
      .map((s: { speaker: string; text: string; start: string; end: string }) => ({
        speaker: s.speaker,
        text: s.text,
        start: s.start,
        end: s.end,
      }))

    return {
      id: r.id,
      filename: r.filename,
      title: r.title,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      durationSec: r.durationSec,
      matches,
    }
  }).filter((r) => r.matches.length > 0)

  return c.json({ results, query: q })
})
