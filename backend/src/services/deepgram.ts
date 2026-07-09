import { spawn } from 'child_process'
import OpenAI from 'openai'
import { z } from 'zod'
import { db } from '../db/client.js'
import { users } from '../db/schema.js'
import type { ExtractedActionItem, TranscriptPayload, TranscriptSegment } from '../db/schema.js'

type Language = 'id' | 'en' | 'auto'

const DEEPGRAM_BASE = 'https://api.deepgram.com/v1/listen'
const DEEPGRAM_MODEL = process.env.DEEPGRAM_MODEL ?? 'nova-3-general'

// Comma-separated keywords to boost during Deepgram recognition. Useful for
// team member names, product names, internal terms — anything nova-3 tends to
// mishear. Deepgram accepts multiple `keywords` query params; we pass each
// trimmed value with the default boost.
const DEEPGRAM_KEYWORDS = (process.env.DEEPGRAM_KEYWORDS ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

// When true, run a conservative GLM polish pass over the raw Deepgram
// transcript to fix Bahasa Indonesia typos, names, and terms. The raw output
// is preserved in TranscriptPayload.rawSegments so users can compare/toggle.
const TRANSCRIPT_POLISH = process.env.TRANSCRIPT_POLISH === '1'

const GLM_BASE_URL = process.env.GLM_BASE_URL ?? 'https://api.z.ai/api/paas/v4'
const GLM_MODEL = process.env.GLM_MODEL ?? 'glm-5.2'

// Audio chunking: meetings longer than this get split via ffmpeg for parallel
// Deepgram transcription. Each chunk is processed independently and word
// timestamps are offset before merging.
const CHUNK_DURATION_SEC = Number(process.env.CHUNK_DURATION_SEC ?? 1800) // 30 min

function dgKey(): string {
  const k = process.env.DEEPGRAM_API_KEY
  if (!k) throw new Error('DEEPGRAM_API_KEY is required')
  return k
}

function glmClient(): OpenAI {
  const k = process.env.GLM_API_KEY
  if (!k) throw new Error('GLM_API_KEY is required')
  return new OpenAI({ apiKey: k, baseURL: GLM_BASE_URL })
}

function formatTimestamp(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

interface DgWord {
  word: string
  start: number
  end: number
  speaker?: number
  punctuated_word?: string
}

interface DgResponse {
  results?: {
    channels?: Array<{
      alternatives?: Array<{
        words?: DgWord[]
        transcript?: string
      }>
      detected_language?: string
    }>
  }
}

function normalizeDetectedLanguage(language: string | undefined): TranscriptPayload['language'] {
  if (!language) return 'mixed'
  if (language.startsWith('id')) return 'id'
  if (language.startsWith('en')) return 'en'
  return 'mixed'
}


// Group word-level Deepgram output into speaker segments
function wordsToSegments(words: DgWord[]): TranscriptSegment[] {
  if (words.length === 0) return []

  const segments: TranscriptSegment[] = []
  let current: { start: number; end: number; speaker: number; words: string[] } = {
    start: words[0].start,
    end: words[0].end,
    speaker: words[0].speaker ?? 0,
    words: [words[0].punctuated_word ?? words[0].word],
  }

  for (let i = 1; i < words.length; i++) {
    const w = words[i]
    const spk = w.speaker ?? 0
    const gap = w.start - current.end

    // New segment on speaker change or long silence (>2s)
    if (spk !== current.speaker || gap > 2) {
      segments.push({
        start: formatTimestamp(current.start),
        end: formatTimestamp(current.end),
        speaker: `Speaker ${current.speaker + 1}`,
        text: current.words.join(' ').trim(),
      })
      current = { start: w.start, end: w.end, speaker: spk, words: [w.punctuated_word ?? w.word] }
    } else {
      current.end = w.end
      current.words.push(w.punctuated_word ?? w.word)
    }
  }

  // Push last segment
  if (current.words.length > 0) {
    segments.push({
      start: formatTimestamp(current.start),
      end: formatTimestamp(current.end),
      speaker: `Speaker ${current.speaker + 1}`,
      text: current.words.join(' ').trim(),
    })
  }

  return segments.filter((s) => s.text.length > 0)
}

// ---------------------------------------------------------------------------
// GLM polish pass (Opsi A)
//
// Conservative cleanup of the raw Deepgram transcript. GLM is only allowed to
// fix obvious mishearings (typos, names, brand/technical terms) — never to
// restructure sentences, add/remove words, or change meaning. The polished
// output replaces `segments` while the raw Deepgram output is preserved in
// `rawSegments` for an audit toggle in the UI.
//
// Chunked the same way as insight extraction so long meetings stay under the
// context limit. Each chunk is processed independently; segment counts must
// match exactly between input and output or the chunk is dropped (fallback to
// raw).
// ---------------------------------------------------------------------------

const polishResponseSchema = z.object({
  segments: z.array(
    z.object({
      speaker: z.string(),
      text: z.string(),
    })
  ),
})

const POLISH_SYSTEM = `Kamu penyunting transkrip rapat Bahasa Indonesia. Tugasmu HANYA memperbaiki transkrip speech-to-text yang salah dengar.`

const POLISH_RULES = `
BOLEH diperbaiki:
- Salah ejaan typo jelas (mis. "ake" -> "aku", "bgaimana" -> "bagaimana", "bgt" -> "banget" jika konteks formal).
- Nama orang/produk/perusahaan/tempat yang misspelled bila konteks sangat jelas (mis. "Solopu" -> "Salopu", "postgress" -> "PostgreSQL"). Jika ragu, BIARKAN apa adanya.
- Istilah teknis/brand yang ejaannya jelas (mis. "githup" -> "GitHub", "slak" -> "Slack").
- Tanda baca yang hilang atau salah.

DILARANG KERAS:
- Mengubah urutan kata, memecah, atau menggabungkan kalimat.
- Menambah atau menghapus kata selain untuk koreksi typo jelas.
- Mengubah makna atau niat pembicara.
- Menerjemahkan atau mengganti kata gaul/formal (pertahankan register asli: "gue", "aku", "saya" tetap).
- Mengubah label speaker.

OUTPUT: JSON { "segments": [{ "speaker": "<PERSIS dari input>", "text": "<diperbaiki>" }] }
Jumlah elemen dan urutan WAJIB sama dengan input. Field speaker TIDAK BOLEH diubah sama sekali.`.trim()

function chunkSegmentsForPolish(segments: TranscriptSegment[]): TranscriptSegment[][] {
  const chunks: TranscriptSegment[][] = []
  let cur: TranscriptSegment[] = []
  let curLen = 0
  for (const seg of segments) {
    const lineLen = `${seg.speaker}: ${seg.text}`.length + 1
    if (curLen + lineLen > CHUNK_CHAR_TARGET && cur.length > 0) {
      chunks.push(cur)
      cur = []
      curLen = 0
    }
    cur.push(seg)
    curLen += lineLen
  }
  if (cur.length > 0) chunks.push(cur)
  return chunks
}

async function polishChunk(chunk: TranscriptSegment[]): Promise<TranscriptSegment[] | null> {
  if (chunk.length === 0) return null
  const inputLines = chunk.map((s) => ({ speaker: s.speaker, text: s.text }))

  let parsed: unknown
  try {
    parsed = await callGlmJson([
      { role: 'system', content: `${POLISH_SYSTEM}\n\n${POLISH_RULES}` },
      {
        role: 'user',
        content: `Berikut adalah ${chunk.length} segmen transkrip mentah. Perbaiki dan kembalikan dalam format JSON yang diminta, dengan JUMLAH DAN URUTAN SAMA:\n\n${JSON.stringify(inputLines)}`,
      },
    ])
  } catch (err) {
    console.warn('polishChunk: GLM call failed:', err)
    return null
  }

  const result = polishResponseSchema.safeParse(parsed)
  if (!result.success) {
    console.warn('polishChunk: malformed response, keeping raw')
    return null
  }

  const out = result.data.segments
  if (out.length !== chunk.length) {
    console.warn(`polishChunk: count mismatch (in=${chunk.length}, out=${out.length}), keeping raw`)
    return null
  }

  // Preserve original timestamps + speaker label (reject GLM if it tampered).
  return chunk.map((seg, i) => {
    const fixed = out[i]
    return {
      start: seg.start,
      end: seg.end,
      speaker: seg.speaker,
      text: (fixed.text ?? '').trim() || seg.text,
    }
  })
}

export async function polishTranscript(segments: TranscriptSegment[]): Promise<{
  polished: TranscriptSegment[]
  raw: TranscriptSegment[]
}> {
  const raw = segments.map((s) => ({ ...s }))
  const chunks = chunkSegmentsForPolish(raw)
  const out: TranscriptSegment[] = []

  for (const chunk of chunks) {
    const fixed = await polishChunk(chunk)
    out.push(...(fixed ?? chunk))
  }

  return { polished: out, raw }
}

// ---------------------------------------------------------------------------
// Insight extraction (summary + per-person action items)
//
// Long meetings are split into character-bounded chunks split on speaker-line
// boundaries. A rolling "carry context" (essence of prior chunks: owners seen,
// decisions, tasks already resolved) is fed into each subsequent chunk so the
// model can resolve references ("dia", "kamu", "tadi") without re-extracting
// duplicates. A final merge pass de-duplicates accumulated action items and
// synthesizes a single coherent summary from the per-chunk summaries.
//
// Output is validated with zod — any malformed GLM response is dropped rather
// than crashing the transcription pipeline.
// ---------------------------------------------------------------------------

const CHUNK_CHAR_TARGET = 22000 // soft per-chunk size (kept well under GLM context limit)
const CARRY_MAX_CHARS = 1800 // rolling context bound
const CONFIDENCE_MIN = 0.15 // below this = discarded; borderline kept & surfaced via UI hint

const actionItemSchema = z.object({
  owner: z.string().min(1).max(80),
  task: z.string().min(2).max(400),
  due: z.string().max(80).nullable().optional(),
  confidence: z.number().min(0).max(1).optional(),
})

// Per-chunk response
const chunkResponseSchema = z.object({
  summary: z.union([z.string(), z.array(z.string())]).optional(),
  actionItems: z.array(actionItemSchema).optional(),
  carryContext: z.string().max(4000).optional(),
})

// Single-shot response (short transcripts) and final-merge response
const mergedResponseSchema = z.object({
  summary: z.union([z.string(), z.array(z.string())]).optional(),
  actionItems: z.array(actionItemSchema).optional(),
  title: z.string().max(120).optional(),
})

function flattenSummary(s: z.infer<typeof chunkResponseSchema>['summary']): string {
  if (!s) return ''
  return Array.isArray(s) ? s.join('\n') : String(s)
}

function normalizeActionItem(raw: z.infer<typeof actionItemSchema>): ExtractedActionItem | null {
  const owner = raw.owner.trim()
  const task = raw.task.trim()
  if (!owner || !task) return null
  const confidence = raw.confidence ?? 0.7
  if (confidence < CONFIDENCE_MIN) return null
  return {
    owner,
    task: task.replace(/^[-*•]\s*/, ''),
    due: raw.due ? raw.due.trim() : null,
    confidence,
  }
}

async function buildUserContext(): Promise<string> {
  try {
    const rows = await db
      .select({
        username: users.username,
        displayName: users.displayName,
        nameAliases: users.nameAliases,
      })
      .from(users)
      .orderBy(users.username)

    if (rows.length === 0) return ''

    const lines = rows.map((u) => {
      const name = u.displayName ?? u.username
      const aliases = (u.nameAliases ?? []).filter(Boolean)
      const aliasStr = aliases.length > 0 ? ` (alias: ${aliases.join(', ')})` : ''
      return `- ${name} (username: ${u.username})${aliasStr}`
    })

    return `DAFTAR ANGGOTA TIM TERDAFTAR:\n${lines.join('\n')}\n\n`
  } catch {
    return ''
  }
}

function buildSystemBase(userContext: string): string {
  return `Kamu asisten analisis rapat Bahasa Indonesia yang sangat disiplin. Format pembicara adalah "Speaker N: <ucapan>". Nama orang asli mungkin disebut di dalam ucapan.

${userContext}ATURAN UTAMA EKSTRAKSI TUGAS:
- Keluarkan SEMUA tugas dari transkrip tanpa batas jumlah. Over-estimate.
- Setiap ORANG bisa punya BANYAK tugas. JANGAN gabungin tugas yang beda.
- Lihat setiap kalimat: imperatif, komitmen, rencana, follow-up, delegasi, pengingat = calon item.

ATURAN MENENTUKAN OWNER (SANGAT PENTING):
- Gunakan daftar ANGGOTA TIM di atas sebagai referensi utama.
- Cocokkan nama yang disebut di rapat dengan anggota tim yang PALING MENDEKATI.
- Contoh: jika disebut "Noel" atau "Yul" dan ada anggota "Yoel" di daftar, owner = "Yoel".
- Contoh: jika disebut "Saloppu" dan ada anggota "Salopu" di daftar, owner = "Salopu".
- Gunakan alias yang terdaftar untuk membantu pencocokan.
- Jika benar-benar tidak ada kecocokan sama sekali, gunakan "Unassigned".
- NILAI BESAR: prioritaskan kecocokan dengan daftar anggota tim daripada "Unassigned".`
}

const ACTION_RULES = `
Output JSON: {"title": "...", "summary": "...", "actionItems": [{owner, task, due, confidence}]}.

OWNER: nama dari daftar anggota tim yang paling cocok, atau "Unassigned".
TASK: deskripsi Bahasa Indonesia yang spesifik dan detail.
CONFIDENCE: >=0.8 sangat eksplisit; 0.5-0.8 indikasi kuat; 0.15-0.5 samar.
DUE: hanya jika disebut eksplisit, null jika tidak ada.
INGAT: LEBIH BAIK 20 tugas dengan 5 false positive daripada 5 kelewat 15.`.trim()

function buildLines(segments: TranscriptSegment[]): string[] {
  return segments.map((s) => `${s.speaker}: ${s.text}`)
}

// Split speaker lines into chunks bounded by CHUNK_CHAR_TARGET without
// breaking a line. Each line is one speaker segment so context stays clean.
function chunkLines(lines: string[]): string[][] {
  if (lines.length === 0) return []
  const chunks: string[][] = []
  let cur: string[] = []
  let curLen = 0
  for (const line of lines) {
    const lineLen = line.length + 1
    if (curLen + lineLen > CHUNK_CHAR_TARGET && cur.length > 0) {
      chunks.push(cur)
      cur = []
      curLen = 0
    }
    cur.push(line)
    curLen += lineLen
  }
  if (cur.length > 0) chunks.push(cur)
  return chunks
}

async function callGlmJson(messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[]): Promise<unknown> {
  const glm = glmClient()
  const response = (await glm.chat.completions.create({
    model: GLM_MODEL,
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
    temperature: 0.2,
    messages,
  } as never)) as OpenAI.Chat.Completions.ChatCompletion
  const raw = response.choices[0]?.message?.content ?? '{}'
  return JSON.parse(raw)
}

interface ChunkResult {
  actionItems: ExtractedActionItem[]
  chunkSummary: string
  carryContext: string
}

async function extractChunk(args: { text: string; carryContext: string; chunkIndex: number; chunkCount: number; userContext: string }): Promise<ChunkResult> {
  const isFirst = args.chunkIndex === 0
  const isLast = args.chunkIndex === args.chunkCount - 1
  const contextBlock = args.carryContext
    ? `\n\n--- KONTEKS DARI BAGIAN SEBELUMNYA ---\n${args.carryContext}`
    : ''

  const system = `${buildSystemBase(args.userContext)}

Kamu menganalisis BAGIAN ${args.chunkIndex + 1} dari ${args.chunkCount} transkrip rapat panjang.${isFirst ? '' : ' Ini BUKAN bagian pertama; gunakan konteks sebelumnya.'}${isLast ? ' Ini bagian terakhir.' : ''}

Tugas:
1. "actionItems": daftar tugas dari BAGIAN INI saja.
2. "summary": 1-3 poin ringkasan bagian ini, masing-masing diawali "- ".
3. "carryContext": essence untuk bagian berikutnya (owner sudah teridentifikasi, keputusan, tugas sudah diambil). Maksimal ~${CARRY_MAX_CHARS} karakter.

${ACTION_RULES}`

  try {
    const parsed = chunkResponseSchema.safeParse(await callGlmJson([
      { role: 'system', content: system },
      { role: 'user', content: args.text + contextBlock },
    ]))
    if (!parsed.success) {
      console.warn(`Chunk ${args.chunkIndex + 1}/${args.chunkCount} parse failed:`, parsed.error.issues[0]?.message)
      return { actionItems: [], chunkSummary: '', carryContext: args.carryContext }
    }
    const actionItems = (parsed.data.actionItems ?? [])
      .map(normalizeActionItem)
      .filter((x): x is ExtractedActionItem => x !== null)
    return {
      actionItems,
      chunkSummary: flattenSummary(parsed.data.summary),
      carryContext: (parsed.data.carryContext ?? args.carryContext).slice(0, CARRY_MAX_CHARS * 2),
    }
  } catch (err) {
    console.warn(`Chunk ${args.chunkIndex + 1}/${args.chunkCount} extraction failed:`, err)
    return { actionItems: [], chunkSummary: '', carryContext: args.carryContext }
  }
}

interface MergeInput {
  chunkSummaries: string[]
  rawItems: ExtractedActionItem[]
}

async function mergeInsights(input: MergeInput & { userContext: string }): Promise<{ summary: string; actionItems: ExtractedActionItem[]; title: string }> {
  const itemsBlock = input.rawItems.length
    ? input.rawItems.map((it, i) => `${i + 1}. [${it.owner}] ${it.task}${it.due ? ` (due: ${it.due})` : ''} (conf: ${it.confidence.toFixed(2)})`).join('\n')
    : '(tidak ada)'
  const summariesBlock = input.chunkSummaries.filter(Boolean).map((s, i) => `Bagian ${i + 1}:\n${s}`).join('\n\n')

  const system = `${buildSystemBase(input.userContext)}

Beberapa bagian transkrip rapat sudah dianalisis terpisah. Tugas kamu:
1. "title": judul SANGAT SINGKAT (3-7 kata).
2. "summary": sintesis 3-5 poin koheren untuk SELURUH rapat.
3. "actionItems": gabungan final dari daftar item mentah di bawah.
   - HAPUS duplikat identik (tugas + owner sama). Ambil confidence TERTINGGI.
   - JANGAN gabung tugas beda meski owner sama.
   - JANGAN tambah item baru.
   - Urutkan per owner, lalu urutan kemunculan.

${ACTION_RULES}`

  try {
    const parsed = mergedResponseSchema.safeParse(await callGlmJson([
      { role: 'system', content: system },
      { role: 'user', content: `Ringkasan per-bagian:\n${summariesBlock}\n\n--- Daftar action item mentah ---\n${itemsBlock}` },
    ]))
    if (!parsed.success) {
      // Fallback: keep raw items and join chunk summaries verbatim
      return { title: '', summary: input.chunkSummaries.filter(Boolean).join('\n'), actionItems: input.rawItems }
    }
    const merged = (parsed.data.actionItems ?? input.rawItems)
      .map(normalizeActionItem)
      .filter((x): x is ExtractedActionItem => x !== null)
    // If merge dropped everything (unlikely), fall back to raw
    const actionItems = merged.length >= input.rawItems.length || input.rawItems.length === 0 ? merged : input.rawItems
    return {
      title: (parsed.data.title ?? '').trim().replace(/^["']|["']$/g, '').slice(0, 120),
      summary: flattenSummary(parsed.data.summary),
      actionItems,
    }
  } catch (err) {
    console.warn('Merge pass failed:', err)
    return { title: '', summary: input.chunkSummaries.filter(Boolean).join('\n'), actionItems: input.rawItems }
  }
}

// ---------------------------------------------------------------------------
// Phase 1: Deepgram transcription (raw audio → words → segments).
// For audio longer than CHUNK_DURATION_SEC, splits via ffmpeg, transcribes
// each chunk sequentially, then merges word arrays with offset timestamps.
// Runs fast — no GLM calls. Returns raw segments for immediate display.
// ---------------------------------------------------------------------------

interface TranscribeAudioResult {
  words: DgWord[]
  segments: TranscriptSegment[]
  detectedLanguage: string | undefined
  durationSec: number
}

function getAudioDuration(buffer: Buffer): Promise<number> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffprobe', [
      '-i', 'pipe:0',
      '-show_entries', 'format=duration',
      '-v', 'quiet',
      '-of', 'csv=p=0',
    ])
    let output = ''
    proc.stdout.on('data', (chunk: Buffer) => output += chunk.toString())
    proc.stderr.on('data', () => {})
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error('ffprobe failed'))
      resolve(parseFloat(output.trim()))
    })
    proc.on('error', reject)
    proc.stdin.on('error', () => {})
    proc.stdin.end(buffer)
  })
}

function extractAudioChunk(buffer: Buffer, startSec: number, durationSec: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', [
      '-i', 'pipe:0',
      '-ss', String(startSec),
      '-t', String(durationSec),
      '-f', 'wav',
      '-ac', '1',
      '-ar', '16000',
      '-vn',
      'pipe:1',
    ])
    const chunks: Buffer[] = []
    proc.stdout.on('data', (chunk: Buffer) => chunks.push(chunk))
    proc.stderr.on('data', () => {})
    proc.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg chunk extraction failed at ${startSec}s`))
      resolve(Buffer.concat(chunks))
    })
    proc.on('error', reject)
    proc.stdin.on('error', () => {})
    proc.stdin.end(buffer)
  })
}

interface DgApiResult {
  words: DgWord[]
  detectedLanguage: string | undefined
}

async function callDeepgram(
  buffer: Buffer,
  mimeType: string,
  language: Language,
): Promise<DgApiResult> {
  const key = dgKey()

  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    diarize: 'true',
    punctuate: 'true',
    smart_format: 'true',
    utterances: 'false',
  })

  if (language === 'auto') {
    params.set('detect_language', 'true')
  } else {
    params.set('language', language)
  }

  for (const kw of DEEPGRAM_KEYWORDS) {
    params.append('keywords', `${kw}:2`)
  }

  const res = await fetch(`${DEEPGRAM_BASE}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${key}`,
      'Content-Type': mimeType,
    },
    body: buffer,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Deepgram transcription failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as DgResponse
  const channel = data.results?.channels?.[0]
  const words = channel?.alternatives?.[0]?.words ?? []
  const detectedLanguage = channel?.detected_language
  console.log(`Deepgram returned ${words.length} words`)

  if (words.length === 0) throw new Error('Deepgram returned empty transcript')

  return { words, detectedLanguage }
}

export async function transcribeAudio(args: {
  buffer: Buffer
  mimeType: string
  language: Language
  onProgress?: (step: string) => void
}): Promise<TranscribeAudioResult> {
  const isLargeFile = args.buffer.length > 50 * 1024 * 1024

  args.onProgress?.('Transcribing audio...')

  if (!isLargeFile) {
    const { words, detectedLanguage } = await callDeepgram(args.buffer, args.mimeType, args.language)
    args.onProgress?.('Processing speaker labels...')
    const segments = wordsToSegments(words)
    const durationSec = Math.ceil(words[words.length - 1]?.end ?? 0)
    return { words, segments, detectedLanguage, durationSec }
  }

  const duration = await getAudioDuration(args.buffer)
  console.log(`Large file (${Math.round(args.buffer.length / 1024 / 1024)}MB, ${Math.round(duration)}s)`)

  if (duration <= CHUNK_DURATION_SEC) {
    const { words, detectedLanguage } = await callDeepgram(args.buffer, args.mimeType, args.language)
    args.onProgress?.('Processing speaker labels...')
    const segments = wordsToSegments(words)
    return { words, segments, detectedLanguage, durationSec: Math.ceil(duration) }
  }

  const chunkCount = Math.ceil(duration / CHUNK_DURATION_SEC)
  console.log(`Splitting into ${chunkCount} chunks`)

  let allWords: DgWord[] = []
  let detectedLanguage: string | undefined

  for (let i = 0; i < chunkCount; i++) {
    const start = i * CHUNK_DURATION_SEC
    const chunkDuration = Math.min(CHUNK_DURATION_SEC, duration - start)

    args.onProgress?.(`Transcribing chunk ${i + 1}/${chunkCount}...`)
    console.log(`Chunk ${i + 1}/${chunkCount} (${start}s)`)

    const chunkBuffer = await extractAudioChunk(args.buffer, start, chunkDuration)
    const result = await callDeepgram(chunkBuffer, 'audio/wav', args.language)

    for (const w of result.words) {
      w.start += start
      w.end += start
    }

    allWords.push(...result.words)
    if (i === 0) detectedLanguage = result.detectedLanguage
  }

  console.log(`Merged: ${allWords.length} words from ${chunkCount} chunks`)

  args.onProgress?.('Processing speaker labels...')
  const segments = wordsToSegments(allWords)

  return { words: allWords, segments, detectedLanguage, durationSec: Math.ceil(duration) }
}

// ---------------------------------------------------------------------------
// Phase 2: GLM polish + summary extraction (runs in background).
// polishTranscript / generateInsights are reused from below.
// ---------------------------------------------------------------------------

// Single-shot path for short transcripts.
async function extractSingle(text: string, userContext: string): Promise<{ summary: string; actionItems: ExtractedActionItem[]; title: string }> {
  const system = `${buildSystemBase(userContext)}

Tugas:
1. "title": judul SANGAT SINGKAT (3-7 kata) dalam Bahasa Indonesia yang mencerminkan inti/topik utama rapat.
2. "summary": 3-5 poin ringkasan rapat dalam Bahasa Indonesia, masing-masing diawali "- ".
3. "actionItems": SEMUA tugas/action items dari transkrip.

${ACTION_RULES}`
  try {
    const parsed = mergedResponseSchema.safeParse(await callGlmJson([
      { role: 'system', content: system },
      { role: 'user', content: text },
    ]))
    if (!parsed.success) {
      console.warn('Single extraction parse failed:', parsed.error.issues[0]?.message)
      return { title: '', summary: '', actionItems: [] }
    }
    return {
      title: (parsed.data.title ?? '').trim().replace(/^["']|["']$/g, '').slice(0, 120),
      summary: flattenSummary(parsed.data.summary),
      actionItems: (parsed.data.actionItems ?? []).map(normalizeActionItem).filter((x): x is ExtractedActionItem => x !== null),
    }
  } catch (err) {
    console.warn('Single extraction failed:', err)
    return { title: '', summary: '', actionItems: [] }
  }
}

export async function generateInsights(segments: TranscriptSegment[]): Promise<{ title: string; summary: string; actionItems: ExtractedActionItem[] }> {
  const lines = buildLines(segments)
  const totalLen = lines.reduce((n, l) => n + l.length + 1, 0)
  const userContext = await buildUserContext()

  if (totalLen <= CHUNK_CHAR_TARGET) {
    return extractSingle(lines.join('\n').slice(0, 60000), userContext)
  }

  const chunks = chunkLines(lines)
  console.log(`Transcript large (${totalLen} chars); splitting into ${chunks.length} chunks`)

  let carryContext = ''
  const chunkSummaries: string[] = []
  const rawItems: ExtractedActionItem[] = []

  for (let i = 0; i < chunks.length; i++) {
    const res = await extractChunk({
      text: chunks[i].join('\n'),
      carryContext,
      chunkIndex: i,
      chunkCount: chunks.length,
      userContext,
    })
    rawItems.push(...res.actionItems)
    chunkSummaries.push(res.chunkSummary)
    carryContext = res.carryContext
  }

  return mergeInsights({ chunkSummaries, rawItems, userContext })
}

export async function transcribeWithDeepgram(args: {
  buffer: Buffer
  mimeType: string
  language: Language
  onProgress?: (step: string) => void
}): Promise<{ payload: TranscriptPayload; durationSec: number; title: string; actionItems: ExtractedActionItem[] }> {
  const { segments, detectedLanguage, durationSec } = await transcribeAudio(args)

  let finalSegments = segments
  let rawSegments: TranscriptSegment[] | undefined
  let polished = false
  if (TRANSCRIPT_POLISH && segments.length > 0) {
    try {
      args.onProgress?.('Refining transcript...')
      const r = await polishTranscript(segments)
      finalSegments = r.polished
      rawSegments = r.raw
      polished = true
      console.log(`Polish pass done (${rawSegments.length} -> ${finalSegments.length} segments)`)
    } catch (err) {
      console.warn('Polish pass failed, keeping raw:', err)
    }
  }

  args.onProgress?.('Generating summary...')
  const insights = await generateInsights(finalSegments)

  const uniqueSpeakers = new Set(finalSegments.map((s) => s.speaker))

  return {
    payload: {
      segments: finalSegments,
      rawSegments,
      polished,
      speakerCount: uniqueSpeakers.size,
      summary: insights.summary,
      language: args.language === 'auto' ? normalizeDetectedLanguage(detectedLanguage) : args.language,
    },
    durationSec,
    title: insights.title,
    actionItems: insights.actionItems,
  }
}
