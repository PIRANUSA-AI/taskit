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
      title: 'Link bagikan tidak ditemukan - PIRANUSA',
      heading: 'Link bagikan tidak ditemukan',
      body: '<p>Link ini tidak valid atau sudah tidak tersedia.</p>',
      robots: 'noindex',
    }), 404)
  }

  const transcript = job.transcript as TranscriptPayload | null
  const title = `${job.filename} - PIRANUSA Transcript`

  if (job.status !== 'completed' || !transcript) {
    return c.html(renderPage({
      title,
      heading: job.filename,
      body: `<p>Status transkrip: <strong>${escapeHtml(job.status)}</strong>. Transkrip belum tersedia untuk dibaca.</p>`,
      robots: 'noindex',
    }))
  }

  const summary = transcript.summary?.trim()
  const segments = transcript.segments ?? []
  const speakerNames = (job.speakerNames ?? {}) as Record<string, string>

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

  // Group action items by owner for the per-person view
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

  return c.html(renderPage({
    title,
    heading: job.filename,
    description: summary ? summary.replace(/\s+/g, ' ').slice(0, 240) : `Transkrip ${job.filename}`,
    body: `
      <section>
        <h2>Metadata</h2>
        <dl>
          <dt>File</dt><dd>${escapeHtml(job.filename)}</dd>
          <dt>Durasi</dt><dd>${job.durationSec ? formatDuration(job.durationSec) : 'Tidak tersedia'}</dd>
          <dt>Bahasa</dt><dd>${escapeHtml(job.language)}</dd>
          <dt>Jumlah pembicara</dt><dd>${transcript.speakerCount}</dd>
          <dt>Dibuat</dt><dd>${job.createdAt.toISOString()}</dd>
        </dl>
      </section>

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

      ${actionItemsHtml}

      <section>
        <h2>Transkrip</h2>
        ${segments.map((segment) => `
          <article>
            <p class="meta">[${escapeHtml(segment.start)} - ${escapeHtml(segment.end)}] ${escapeHtml(resolveName(segment.speaker))}</p>
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
}): string {
  const description = args.description ?? 'PIRANUSA public transcript'
  return `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="robots" content="${escapeHtml(args.robots ?? 'index,follow')}" />
    <title>${escapeHtml(args.title)}</title>
    <style>
      :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
      body { margin: 0; background: #F8FAFC; color: #0F172A; line-height: 1.65; }
      main { max-width: 820px; margin: 0 auto; padding: 40px 20px 72px; }
      header { border-bottom: 1px solid #E2E8F0; background: #1E1B4B; color: #fff; }
      header div { max-width: 820px; margin: 0 auto; padding: 18px 20px; font-weight: 700; letter-spacing: 0.04em; }
      h1 { font-size: clamp(28px, 4vw, 42px); line-height: 1.1; margin: 0 0 24px; color: #1E1B4B; }
      h2 { margin-top: 36px; padding-top: 18px; border-top: 1px solid #E2E8F0; font-size: 18px; color: #1E1B4B; }
      dl { display: grid; grid-template-columns: 160px 1fr; gap: 8px 16px; }
      dt { color: #64748B; }
      dd { margin: 0; }
      article { padding: 14px 0; border-bottom: 1px solid #E2E8F0; }
      .meta { color: #64748B; font-size: 13px; margin-bottom: 4px; }
      .owner-group { margin: 14px 0; padding: 14px 18px; background: #fff; border: 1px solid #E2E8F0; border-radius: 12px; }
      .owner-group h3 { margin: 0 0 10px; font-size: 15px; color: #4F46E5; }
      .owner-group ul { list-style: none; padding: 0; margin: 0; }
      .owner-group li { display: flex; gap: 8px; padding: 5px 0; font-size: 14px; }
      .owner-group .box { font-size: 14px; line-height: 1.4; color: #64748B; }
      .owner-group em { color: #64748B; font-style: normal; font-size: 12px; }
      .owner-group .hint { color: #d97706; font-size: 12px; }
      pre { white-space: pre-wrap; word-break: break-word; background: #fff; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; }
      a { color: inherit; }
    </style>
  </head>
  <body>
    <header><div>PIRANUSA Public Transcript</div></header>
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
