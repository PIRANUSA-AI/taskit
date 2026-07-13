import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Buildings, WarningCircle } from '@phosphor-icons/react'
import { ApiError, api, type SharedMomDetail } from '../lib/api'
import { LoadingScreen } from '../components/LoadingScreen'
import { formatDuration } from '../lib/format'
import { BrandMark } from '../components/Brand'

export default function SharedMoM() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<SharedMomDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setError(null)
    api
      .get<SharedMomDetail>(`/share/mom/${token}`)
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError) setError(err.message)
        else setError('Gagal memuat Minutes of Meeting')
      })
  }, [token])

  if (error) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 bg-paper aurora">
        <div className="text-center max-w-sm">
          <WarningCircle weight="duotone" size={48} className="mx-auto text-red-500" />
          <p className="mt-3 font-medium text-navy">{error}</p>
          <Link to="/welcome" className="btn-ghost mt-6 inline-flex">
            <ArrowLeft size={16} />
            Beranda
          </Link>
        </div>
      </div>
    )
  }

  if (!data) return <LoadingScreen />

  const title = data.title?.trim() || data.filename.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ')

  const summaryLines = (data.summary ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.replace(/^[-*]\s*/, ''))

  const speakerLabels = Array.from({ length: data.speakerCount }, (_, i) => `Speaker ${i + 1}`)
  const attendees = Array.from(
    new Set(speakerLabels.map((s) => data.speakerNames[s] ?? s).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b))

  const dateStr = new Date(data.createdAt).toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const MetaItem = ({ label, value }: { label: string; value: string }) => (
    <div className="flex flex-col gap-0.5 p-3 bg-slate-50 rounded-lg">
      <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted">{label}</span>
      <span className="text-sm text-navy font-medium">{value}</span>
    </div>
  )

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="border-b border-slate-200/70 bg-paper/85 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 md:px-8">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-navy">Pinote</span>
          </Link>
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
            <Buildings size={12} weight="fill" />
            Minutes of Meeting
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 md:px-8 pt-6 pb-24 md:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 22 }}
          className="card p-6 md:p-8"
        >
          <div className="text-[11px] uppercase tracking-[0.12em] font-bold text-indigo-500">Minutes of Meeting</div>
          <h1 className="mt-1.5 text-2xl md:text-[28px] font-semibold leading-tight text-navy">{title}</h1>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <MetaItem label="Tanggal" value={dateStr} />
            <MetaItem label="Durasi" value={data.durationSec ? formatDuration(data.durationSec) : '—'} />
            <MetaItem label="Bahasa" value={data.language} />
            <MetaItem label="Pembicara" value={`${data.speakerCount} orang`} />
            {attendees.length > 0 && (
              <div className="col-span-2 flex flex-col gap-0.5 p-3 bg-slate-50 rounded-lg">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-ink-muted">Hadiririn</span>
                <span className="text-sm text-navy font-medium">{attendees.join(', ')}</span>
              </div>
            )}
          </div>

          {summaryLines.length > 0 && (
            <section className="mt-7">
              <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Ringkasan Pembahasan</h2>
              <ul className="mt-2 space-y-1.5">
                {summaryLines.map((line, i) => (
                  <li key={i} className="text-sm text-ink leading-relaxed flex gap-2">
                    <span className="text-indigo-400 flex-shrink-0 mt-0.5">•</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-7">
            <h2 className="text-xs font-bold uppercase tracking-wide text-slate-500">Tindakan &amp; Tindak Lanjut</h2>
            {data.actionItems.length === 0 ? (
              <p className="mt-2 text-sm text-ink-muted">Tidak ada tindakan tercatat.</p>
            ) : (
              <div className="mt-2 overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                      <th className="text-left px-3 py-2 font-semibold w-8">#</th>
                      <th className="text-left px-3 py-2 font-semibold">Tindakan</th>
                      <th className="text-left px-3 py-2 font-semibold">Penanggung Jawab</th>
                      <th className="text-left px-3 py-2 font-semibold">Tenggat</th>
                      <th className="text-left px-3 py-2 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.actionItems.map((it, i) => {
                      const ownerName = data.speakerNames[it.owner] ?? it.owner
                      return (
                        <tr key={it.id} className="border-t border-slate-100">
                          <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-2 text-ink align-top">{it.task}</td>
                          <td className="px-3 py-2 text-ink align-top">{ownerName}</td>
                          <td className="px-3 py-2 text-ink-muted align-top">{it.due ?? '—'}</td>
                          <td className="px-3 py-2 align-top">
                            {it.done ? (
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Selesai</span>
                            ) : (
                              <span className="inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Terbuka</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <footer className="mt-8 pt-5 border-t border-slate-200 text-xs text-ink-muted leading-relaxed">
            <p>Dokumen ini dibuat otomatis dari rekaman rapat menggunakan Pinote. Hanya berisi ringkasan dan tindak lanjut — bukan transkrip penuh.</p>
            <p className="mt-1">Disiapkan {dateStr} · Dipublikasikan via Pinote</p>
          </footer>
        </motion.div>
      </main>
    </div>
  )
}
