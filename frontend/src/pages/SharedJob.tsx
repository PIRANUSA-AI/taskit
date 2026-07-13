import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, WarningCircle } from '@phosphor-icons/react'
import { ApiError, api, type SharedJobDetail } from '../lib/api'
import { LoadingScreen } from '../components/LoadingScreen'
import { TranscriptViewer } from '../components/TranscriptViewer'
import { TitleScrambler } from '../components/TitleScrambler'
import { formatDuration, formatRelativeTime } from '../lib/format'
import { BrandMark } from '../components/Brand'

export default function SharedJob() {
  const { token } = useParams<{ token: string }>()
  const [job, setJob] = useState<SharedJobDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    setError(null)
    api
      .get<SharedJobDetail>(`/share/${token}`)
      .then((data) => {
        setJob(data)
        if (data.hasAudio) {
          api.get<{ url: string }>(`/share/${token}/audio`).then((r) => setAudioUrl(r.url)).catch(() => {})
        }
      })
      .catch((err) => {
        if (err instanceof ApiError) setError(err.message)
        else setError('Gagal memuat link bagikan')
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

  if (!job) return <LoadingScreen />

  const transcript = job.transcript

  return (
    <div className="min-h-[100dvh] bg-paper">
      <header className="border-b border-slate-200/70 bg-paper/85 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 md:px-8">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <BrandMark size={28} />
            <span className="text-[15px] font-semibold tracking-tight text-navy">Pinote</span>
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500 bg-indigo-50 px-2 py-1 rounded">Link Internal</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 md:px-8 pt-6 pb-24 md:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 22 }}
        >
          <div className="min-w-0">
            <h1
              className="text-2xl md:text-3xl tracking-tightest font-semibold leading-tight text-navy"
              title={job.filename}
            >
              <TitleScrambler from={job.filename} to={job.title} />
            </h1>
            <p className="mt-2 text-xs text-ink-muted tabular">
              {[
                formatRelativeTime(job.createdAt),
                job.durationSec ? formatDuration(job.durationSec) : null,
                transcript?.speakerCount ? `${transcript.speakerCount} pembicara` : null,
              ]
                .filter(Boolean)
                .join(' | ')}
            </p>
          </div>
        </motion.div>

        <div className="mt-6 space-y-6">
          {audioUrl && (
            <div className="card p-4">
              <audio controls preload="metadata" className="w-full">
                <source src={audioUrl} />
              </audio>
            </div>
          )}

          {transcript ? (
            <TranscriptViewer
              transcript={transcript}
              filename={job.filename}
              jobId={job.id}
              actionItems={job.actionItems}
              speakerNames={job.speakerNames}
              readOnly
            />
          ) : (
            <div className="card p-8 text-center">
              <WarningCircle weight="duotone" size={48} className="mx-auto text-amber-500" />
              <p className="mt-3 text-sm text-ink-muted">Transkrip belum tersedia untuk link ini.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
