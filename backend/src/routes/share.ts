import { Hono } from 'hono'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '../db/client.js'
import { actionItems, jobs, type ActionItemRow, type TranscriptPayload } from '../db/schema.js'

export const shareRouter = new Hono()

shareRouter.get('/:token', async (c) => {
  const token = c.req.param('token')
  const [job] = await db.select().from(jobs).where(eq(jobs.shareToken, token)).limit(1)

  if (!job) {
    return c.html(renderPage({
      title: 'Link bagikan tidak ditemukan - TASKIT',
      heading: 'Link bagikan tidak ditemukan',
      body: '<p>Link ini tidak valid atau sudah tidak tersedia.</p>',
      robots: 'noindex',
      image: null,
      shareUrl: c.req.url,
    }), 404)
  }

  const transcript = job.transcript as TranscriptPayload | null
  const meetingTitle = job.title?.trim() || job.filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')
  const pageTitle = `${meetingTitle} - TASKIT`

  if (job.status !== 'completed' || !transcript) {
    return c.html(renderPage({
      title: pageTitle,
      heading: meetingTitle,
      body: `<p>Status transkrip: <strong>${escapeHtml(job.status)}</strong>. Transkrip belum tersedia untuk dibaca.</p>`,
      robots: 'noindex',
      image: null,
      shareUrl: c.req.url,
    }))
  }

  const summary = transcript.summary?.trim()
  const segments = transcript.segments ?? []
  const speakerNames = (job.speakerNames ?? {}) as Record<string, string>
  const hasPolishedTranscript = transcript.polished && transcript.rawSegments !== undefined

  let items: ActionItemRow[] = []
  try {
    items = await db
      .select()
      .from(actionItems)
      .where(and(eq(actionItems.jobId, job.id)))
      .orderBy(asc(actionItems.order), asc(actionItems.createdAt))
  } catch (err) {
    console.warn(`share render: failed to load action items for ${job.id}:`, err)
  }

  const byOwner = new Map<string, ActionItemRow[]>()
  for (const it of items) {
    const arr = byOwner.get(it.owner) ?? []
    arr.push(it)
    byOwner.set(it.owner, arr)
  }
  const ownerOrder = [...byOwner.keys()]

  const resolveName = (owner: string) => speakerNames[owner] ?? owner

  const actionItemsHtml = ownerOrder.length
    ? `
      <section>
        <h2>Action Items</h2>
        ${ownerOrder
          .map(
            (owner) => {
              const tasks = byOwner.get(owner)!
              return `
            <div class="owner-group">
              <h3>${escapeHtml(resolveName(owner))}</h3>
              <ul>
                ${tasks
                  .map(
                    (t) =>
                      `<li><span class="box">${t.done ? '&#9745;' : '&#9744;'}</span> ${escapeHtml(t.task)}${t.due ? ` <em>(${escapeHtml(t.due)})</em>` : ''}${t.confidence < 0.8 ? ' <span class="hint">(perlu ditinjau)</span>' : ''}</li>`
                  )
                  .join('\n')}
              </ul>
            </div>`
            }
          )
          .join('\n')}
      </section>`
    : ''

  const description = summary
    ? summary.replace(/\s+/g, ' ').slice(0, 240)
    : `Transkrip meeting: ${meetingTitle}`

  return c.html(renderPage({
    title: pageTitle,
    heading: meetingTitle,
    description,
    image: null,
    shareUrl: c.req.url,
    body: `
      ${summary ? `
        <section>
          <h2>Ringkasan</h2>
          ${summary
            .split('\n')
            .filter(Boolean)
            .map((line) => `<p>${escapeHtml(line.replace(/^[-*]\s*/, ''))}</p>`)
            .join('\n')}
        </section>
      ` : ''}

      <section>
        <h2>Metadata Meeting</h2>
        <dl>
          <dt>Judul</dt><dd>${escapeHtml(meetingTitle)}</dd>
          <dt>Durasi</dt><dd>${job.durationSec ? formatDuration(job.durationSec) : 'Tidak tersedia'}</dd>
          <dt>Bahasa</dt><dd>${escapeHtml(job.language)}</dd>
          <dt>Pembicara</dt><dd>${transcript.speakerCount} orang</dd>
          <dt>Tanggal</dt><dd>${job.createdAt.toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</dd>
        </dl>
      </section>

      ${!hasPolishedTranscript ? '<p class="notice">Transkrip masih dalam proses penyempurnaan. Segarkan halaman untuk melihat hasil akhir.</p>' : ''}

      ${actionItemsHtml}

      <section>
        <h2>Transkrip</h2>
        <p class="meta-count">${segments.length} segmen percakapan</p>
        ${segments.map((segment) => `
          <article>
            <p class="meta"><time>${escapeHtml(segment.start)}</time> &ndash; <time>${escapeHtml(segment.end)}</time> &middot; ${escapeHtml(resolveName(segment.speaker))}</p>
            <p>${escapeHtml(segment.text)}</p>
          </article>
        `).join('\n')}
      </section>
    `,
  }))
})

function renderPage(args: {
  title: string
  heading: string
  body: string
  description?: string
  robots?: string
  image: string | null
  shareUrl?: string
}): string {
  const description = args.description ?? 'TASKIT public transcript'
  const url = args.shareUrl ?? ''
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${escapeHtml(args.robots ?? 'index,follow')}" />

    <!-- Open Graph -->
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${escapeHtml(url)}" />
    <meta property="og:title" content="${escapeHtml(args.heading)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:site_name" content="TASKIT" />
    ${args.image ? `<meta property="og:image" content="${escapeHtml(args.image)}" />` : ''}

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtml(args.heading)}" />
    <meta name="twitter:description" content="${escapeHtml(description)}" />

    <title>${escapeHtml(args.title)}</title>

    <!-- JSON-LD for AI agents / search engines -->
    <script type="application/ld+json">
    ${JSON.stringify({
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: args.heading,
      description,
      about: 'Meeting transcript',
      inLanguage: 'id',
      dateCreated: new Date().toISOString().split('T')[0],
    })}
    </script>

    <style>
      :root { color-scheme: light dark; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif; }
      *, *::before, *::after { box-sizing: border-box; }
      body { margin: 0; background: #F8FAFC; color: #0F172A; line-height: 1.7; -webkit-font-smoothing: antialiased; }
      @media (prefers-color-scheme: dark) {
        body { background: #0F172A; color: #E2E8F0; }
        header { background: #1E1B4B; }
        .owner-group { background: #1E293B; border-color: #334155; }
        .owner-group h3 { color: #A5B4FC; }
        article { border-color: #334155; }
        .meta, .meta-count, dt { color: #94A3B8; }
        header div small { color: #94A3B8; }
        .notice { background: #422006; border-color: #92400E; color: #FBBF24; }
      }
      main { max-width: 880px; margin: 0 auto; padding: 32px 20px 80px; }
      header { border-bottom: 1px solid #E2E8F0; background: #0F172A; color: #fff; }
      header div { max-width: 880px; margin: 0 auto; padding: 16px 20px; display: flex; align-items: baseline; gap: 12px; font-weight: 700; letter-spacing: 0.03em; }
      header div small { font-weight: 400; color: #94A3B8; letter-spacing: 0; }
      h1 { font-size: clamp(26px, 3.5vw, 40px); line-height: 1.15; margin: 0 0 20px; color: inherit; }
      h2 { margin-top: 40px; padding-top: 20px; border-top: 1px solid; border-color: #E2E8F0; font-size: 18px; font-weight: 600; color: inherit; }
      @media (prefers-color-scheme: dark) { h2 { border-color: #334155; } }
      p { margin: 0 0 12px; }
      dl { display: grid; grid-template-columns: 140px 1fr; gap: 6px 16px; font-size: 14px; }
      dt { color: #64748B; }
      dd { margin: 0; }
      article { padding: 16px 0; border-bottom: 1px solid #E2E8F0; }
      @media (prefers-color-scheme: dark) { article { border-color: #334155; } }
      article:last-of-type { border-bottom: 0; }
      .meta { color: #64748B; font-size: 13px; margin-bottom: 4px; display: flex; gap: 6px; align-items: center; }
      .meta time { font-variant-numeric: tabular-nums; }
      .meta-count { color: #64748B; font-size: 13px; margin-bottom: 0; }
      .owner-group { margin: 12px 0; padding: 16px 20px; background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; }
      @media (prefers-color-scheme: dark) { .owner-group { background: #1E293B; border-color: #334155; } }
      .owner-group h3 { margin: 0 0 10px; font-size: 15px; color: #4F46E5; }
      .owner-group ul { list-style: none; padding: 0; margin: 0; }
      .owner-group li { display: flex; gap: 8px; padding: 6px 0; font-size: 14px; line-height: 1.5; }
      .owner-group li + li { border-top: 1px solid #F1F5F9; }
      @media (prefers-color-scheme: dark) { .owner-group li + li { border-color: #334155; } }
      .owner-group .box { flex-shrink: 0; font-size: 14px; color: #64748B; }
      .owner-group em { color: #64748B; font-style: normal; font-size: 12px; }
      .owner-group .hint { color: #D97706; font-size: 12px; }
      .notice { padding: 12px 16px; background: #FEF3C7; border: 1px solid #F59E0B; border-radius: 8px; font-size: 14px; color: #92400E; margin: 20px 0; }
      a { color: #4F46E5; text-decoration: underline; text-underline-offset: 2px; }
      @media (prefers-color-scheme: dark) { a { color: #A5B4FC; } }
    </style>
  </head>
  <body>
    <header>
      <div>
        <span>TASKIT</span>
        <small>Public Transcript</small>
      </div>
    </header>
    <main>
      <h1>${escapeHtml(args.heading)}</h1>
      ${args.body}
    </main>
  </body>
</html>`
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  if (h > 0) return `${h}j ${m}m ${s}d`
  if (m > 0) return `${m}m ${s}d`
  return `${s}d`
}
