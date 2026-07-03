import OpenAI from 'openai'
import { z } from 'zod'
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

async function polishTranscript(segments: TranscriptSegment[]): Promise<{
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

const SYSTEM_BASE = `Kamu asisten analisis rapat Bahasa Indonesia yang sangat disiplin. Format pembicara adalah "Speaker N: <ucapan>". Nama orang asli mungkin disebut di dalam ucapan (mis. "Salopu", "Johan").`

const ACTION_RULES = `
PRINSIP UTAMA — EKSTRAKSI MENYELURUH (SANGAT PENTING):
- Keluarkan SEMUA tugas yang ditugaskan dalam transkrip. TIDAK ADA batas jumlah. Sebuah rapat 1 jam sering punya 15-25+ action items — intuisi kamu HARUS over-estimate.
- Setiap ORANG bisa memiliki BANYAK tugas. Jangan dibatasi. Misal jika Dina diminta: update laporan, cek invoice, follow up klien X, koordinasi tim marketing — itu 4 tugas terpisah untuk Dina, keluarkan SEMUANYA sebagai 4 item berbeda.
- JANGAN PERNAH menyederhanakan/menggabungkan tugas berbeda menjadi satu. Misal "kirim laporan sales" dan "update CRM" = DUA item.
- Lihat transkrip baris demi baris. SETIAP kalimat yang mengandung unsur penugasan, permintaan, komitmen, atau rencana = calon item. Kalau ragu, TETAP KELUARKAN dengan confidence rendah (0.15-0.4) — lebih baik terlalu banyak daripada kelewat.

ATURAN PENUGASAN (lebih longgar — ambil SEMUA yang mendekati tugas):
- TUGAS: imperatif langsung ("tolong kirim", "mohon update", "bantu cek", "kamu yang handle"), komitmen ("aku akan...", "nanti saya...", "saya usahakan"), rencana ("nanti kita bahas lanjutan", "minggu depan kita ..."), jadwal ("rapat lanjutan hari Jumat"), follow-up ("ditindaklanjuti", "di-check", "di-monitor"), delegasi ("minta tolong", "bisa minta bantuannya?"), pengingat ("jangan lupa", "pastikan").
- JUGA ambil: kalimat yang menyiratkan tindakan ("...perlu diselesaikan", "...harus segera", "masalahnya perlu diurus", "kita perlu ...", "saya akan kirimkan", "tolong dibantu", "nanti dikoordinasikan").
- JANGAN: pertanyaan retoris, opini murni tanpa tindak lanjut, basa-basi.
- owner = nama orang asli yang disebut ATAU "Speaker N" jika speaker menugaskan diri sendiri. Jika tidak jelas, "Unassigned".
- task = deskripsi spesifik Bahasa Indonesia, kalimat aktif. Pertahankan detail.
- confidence: >=0.8 sangat eksplisit; 0.5-0.8 indikasi kuat; 0.15-0.5 samar tapi tetap keluar.
- due = hanya jika disebut eksplisit.

INGAT: LEBIH BAIK 20 tugas dengan 5 false positive daripada 5 tasks kelewat 15. Kuantitas diutamakan.`.trim()

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

async function extractChunk(args: { text: string; carryContext: string; chunkIndex: number; chunkCount: number }): Promise<ChunkResult> {
  const isFirst = args.chunkIndex === 0
  const isLast = args.chunkIndex === args.chunkCount - 1
  const contextBlock = args.carryContext
    ? `\n\n--- KONTEKS DARI BAGIAN SEBELUMNYA (gunakan untuk resolve referensi "dia/tadi/itu", JANGAN ekstrak ulang item yang sama) ---\n${args.carryContext}`
    : ''

  const system = `${SYSTEM_BASE}

Kamu menganalisis BAGIAN ${args.chunkIndex + 1} dari ${args.chunkCount} sebuah transkrip rapat panjang.${isFirst ? '' : ' Ini BUKAN bagian pertama; gunakan konteks sebelumnya untuk memahami referensi.'}${isLast ? ' Ini bagian terakhir.' : ''}

Tugas:
1. "actionItems": daftar tugas/action items dari BAGIAN INI saja, mengikuti aturan ketat di bawah.
2. "summary": 1-3 poin ringkasan singkat BAGIAN INI (Bahasa Indonesia, masing-masing diawali "- ").
3. "carryContext": essence penting untuk dibawa ke bagian berikutnya (DAFTAR owner yang sudah teridentifikasi + nama asli jika diketahui, keputusan/decision points, dan tugas yang SUDAH diambil — agar tidak diekstrak ulang). Maksimal ~${CARRY_MAX_CHARS} karakter, padat dan informatif.

${ACTION_RULES}

Output JSON: {"summary": "...", "actionItems": [{owner, task, due, confidence}], "carryContext": "..."}. HANYA JSON.`

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

async function mergeInsights(input: MergeInput): Promise<{ summary: string; actionItems: ExtractedActionItem[]; title: string }> {
  const itemsBlock = input.rawItems.length
    ? input.rawItems.map((it, i) => `${i + 1}. [${it.owner}] ${it.task}${it.due ? ` (due: ${it.due})` : ''} (conf: ${it.confidence.toFixed(2)})`).join('\n')
    : '(tidak ada)'
  const summariesBlock = input.chunkSummaries.filter(Boolean).map((s, i) => `Bagian ${i + 1}:\n${s}`).join('\n\n')

  const system = `${SYSTEM_BASE}

Beberapa bagian transkrip rapat sudah dianalisis terpisah. Tugas kamu:
1. "title": judul SANGAT SINGKAT (3-7 kata) dalam Bahasa Indonesia yang mencerminkan inti/topik utama rapat.
2. "summary": sintesis 3-5 poin koheren untuk SELURUH rapat dari ringkasan per-bagian di bawah (Bahasa Indonesia, masing-masing diawali "- ").
3. "actionItems": gabungan final dari daftar item mentah di bawah. ATURAN PENTING:
   - HAPUS duplikat yang BENAR-BENAR sama (tugas identik untuk owner sama dari chunk berbeda). Ambil confidence TERTINGGI.
   - JANGAN GABUNGKAN dua tugas berbeda hanya karena owner-nya sama atau mirip. Misal "[Dina] kirim laporan" dan "[Dina] update CRM" = DUA item terpisah, pertahankan keduanya.
   - JANGAN menambah item baru yang tidak ada di daftar.
   - JANGAN menghapus item hanya karena terdengar sepele/pendek. Pertahankan SEMUA item valid.
   - Pertahankan detail spesifik dari task (objek, tujuan, lokasi). Jangan digeneralisasi.
   - Urutkan: kumpulkan per owner, lalu ikuti urutan kemunculan.

Output JSON: {"title": "...", "summary": "...", "actionItems": [{owner, task, due, confidence}]}. HANYA JSON.`

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

// Single-shot path for short transcripts.
async function extractSingle(text: string): Promise<{ summary: string; actionItems: ExtractedActionItem[]; title: string }> {
  const system = `${SYSTEM_BASE}

Tugas:
1. "title": judul SANGAT SINGKAT (3-7 kata) dalam Bahasa Indonesia yang mencerminkan inti/topik utama rapat. Tanpa prefix, tanpa tanda kutip, tanpa nama file. Contoh baik: "Rencana Q1 Tim Sales". Contoh buruk: "Rapat Tim", nama file audio.
2. "summary": 3-5 poin ringkasan rapat dalam Bahasa Indonesia, masing-masing diawali "- ".
3. "actionItems": SEMUA tugas/action items dari transkrip, mengikuti aturan di bawah.

${ACTION_RULES}

Output JSON: {"title": "...", "summary": "...", "actionItems": [{owner, task, due, confidence}]}. HANYA JSON.`
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

async function generateInsights(segments: TranscriptSegment[]): Promise<{ title: string; summary: string; actionItems: ExtractedActionItem[] }> {
  const lines = buildLines(segments)
  const totalLen = lines.reduce((n, l) => n + l.length + 1, 0)

  // Short transcript: one call returns both summary and action items.
  if (totalLen <= CHUNK_CHAR_TARGET) {
    return extractSingle(lines.join('\n').slice(0, 60000))
  }

  // Long transcript: chunked extraction with carry-over, then merge pass.
  const chunks = chunkLines(lines)
  console.log(`Transcript large (${totalLen} chars); splitting into ${chunks.length} chunks with carry-over context`)

  let carryContext = ''
  const chunkSummaries: string[] = []
  const rawItems: ExtractedActionItem[] = []

  for (let i = 0; i < chunks.length; i++) {
    const res = await extractChunk({
      text: chunks[i].join('\n'),
      carryContext: carryContext,
      chunkIndex: i,
      chunkCount: chunks.length,
    })
    rawItems.push(...res.actionItems)
    chunkSummaries.push(res.chunkSummary)
    carryContext = res.carryContext
  }

  return mergeInsights({ chunkSummaries, rawItems })
}

export async function transcribeWithDeepgram(args: {
  buffer: Buffer
  mimeType: string
  language: Language
  onProgress?: (step: string) => void
}): Promise<{ payload: TranscriptPayload; durationSec: number; title: string; actionItems: ExtractedActionItem[] }> {
  const key = dgKey()

  const params = new URLSearchParams({
    model: DEEPGRAM_MODEL,
    diarize: 'true',
    punctuate: 'true',
    smart_format: 'true',
    utterances: 'false',
  })

  if (args.language === 'auto') {
    params.set('detect_language', 'true')
  } else {
    params.set('language', args.language)
  }

  // Keyword boosting (Opsi C) — tell Deepgram to weight team names/terms so
  // nova-3 stops hallucinating them.
  for (const kw of DEEPGRAM_KEYWORDS) {
    params.append('keywords', `${kw}:2`)
  }

  args.onProgress?.('Transcribing audio...')
  console.log(`Sending ${Math.round(args.buffer.length / 1024 / 1024)}MB to Deepgram (model: ${DEEPGRAM_MODEL}, lang: ${args.language})`)

  const res = await fetch(`${DEEPGRAM_BASE}?${params}`, {
    method: 'POST',
    headers: {
      Authorization: `Token ${key}`,
      'Content-Type': args.mimeType,
    },
    body: args.buffer,
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

  args.onProgress?.('Processing speaker labels...')
  const segments = wordsToSegments(words)
  console.log(`Grouped into ${segments.length} segments`)

  // Opsi A: conservative GLM polish pass. Raw Deepgram output is preserved so
  // the UI can offer a "raw vs polished" toggle. Failures fall back to raw.
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

  // Actual audio duration from the last word's end timestamp (Deepgram is authoritative)
  const durationSec = Math.ceil(words[words.length - 1]?.end ?? 0)

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
