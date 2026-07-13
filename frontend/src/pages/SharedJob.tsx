import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, WarningCircle } from '@phosphor-icons/react'
import { ApiError, api, type SharedJobDetail } from '../lib/api'
import { LoadingScreen } from '../components/LoadingScreen'
import { TranscriptViewer } from '../components/TranscriptViewer'
import { ActionItemsPanel } from '../components/ActionItemsPanel'
import { AudioPlayer } from '../components/AudioPlayer'
import { MiniPlayer } from '../components/MiniPlayer'
import { TitleScrambler } from '../components/TitleScrambler'
import { formatDuration, formatRelativeTime } from '../lib/format'
import { BrandMark } from '../components/Brand'

export default function SharedJob() {
  const { token } = useParams<{ token: string }>()
  const [job, setJob] = useState<SharedJobDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const [audioTime, setAudioTime] = useState(0)
  const [audioPlaying, setAudioPlaying] = useState(false)
  const [audioDuration, setAudioDuration] = useState(0)
  const audioRef = useRef<HTMLAudioElement | null>(null)

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

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const audio = audioRef.current
      if (!audio) return
      if (e.code === 'Space') {
        e.preventDefault()
        if (audio.paused) audio.play()
        else audio.pause()
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault()
        audio.currentTime = Math.max(0, audio.currentTime - 5)
      } else if (e.code === 'ArrowRight') {
        e.preventDefault()
        audio.currentTime = Math.min(audio.duration || 0, audio.currentTime + 5)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

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
  const isReady = job.status === 'completed' && transcript

  return (
    <div className={`mx-auto w-full max-w-7xl px-4 lg:px-8 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-12 ${audioPlaying ? 'pt-16' : 'pt-6'}`}>
      <header className="border-b border-slate-200/70 bg-paper/85 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between -mx-4 lg:-mx-8 px-4 lg:px-8">
          <Link to="/welcome" className="flex items-center gap-2.5">
            <BrandMark size={26} />
            <span className="text-[15px] font-semibold tracking-tight text-navy">Pinote</span>
          </Link>
          <span className="text-[10px] font-semibold uppercase tracking-wide text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Link Internal</span>
        </div>
      </header>

      <div className="mt-6">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 22 }}
        >
          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl tracking-tightest font-semibold leading-tight truncate text-navy" title={job.filename}>
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

        <div className="mt-8">
          {isReady ? (
            <>
              {(!transcript!.summary || transcript!.summary.length === 0) && (
                <div className="card p-4 mb-4 flex items-center gap-3 bg-amber-50 border border-amber-200">
                  <div className="flex items-end gap-0.5 h-4">
                    {[0, 1, 2].map((i) => (
                      <span key={i} className="w-1 bg-amber-400 rounded-full animate-pulse-ring" style={{ animationDelay: `${i * 120}ms`, height: `${8 + (i % 3) * 4}px` }} />
                    ))}
                  </div>
                  <p className="text-sm text-amber-800 font-medium">Ringkasan dan tugas masih disiapkan...</p>
                </div>
              )}
              <div className="lg:grid lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] lg:gap-8">
                <div className="min-w-0">
                  {audioUrl && (
                    <AudioPlayer
                      src={audioUrl}
                      mimeType={job.mimeType ?? undefined}
                      audioRef={audioRef}
                      onTimeUpdate={setAudioTime}
                      onPlayingChange={setAudioPlaying}
                      onDuration={setAudioDuration}
                    />
                  )}
                  <TranscriptViewer
                    transcript={transcript!}
                    filename={job.filename}
                    speakerNames={job.speakerNames}
                    readOnly
                    audioCurrentTime={audioTime}
                  />
                </div>
                <div className="mt-6 lg:mt-0 lg:block space-y-4">
                  <div className="lg:sticky lg:top-20">
                    {job.actionItems.length > 0 && (
                      <ActionItemsPanel
                        jobId={job.id}
                        actionItems={job.actionItems}
                        speakerNames={job.speakerNames}
                        readOnly
                      />
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="card p-8 text-center">
              <WarningCircle weight="duotone" size={48} className="mx-auto text-amber-500" />
              <h2 className="mt-4 text-lg font-semibold text-navy">Transkrip belum tersedia</h2>
              <p className="mt-2 text-sm text-ink-muted">Status saat ini: {job.status}. Coba segarkan halaman nanti.</p>
            </div>
          )}
        </div>
      </div>

      {audioPlaying && (
        <MiniPlayer
          audioRef={audioRef}
          playing={audioPlaying}
          currentTime={audioTime}
          duration={audioDuration}
          filename={job.filename}
          onClose={() => { audioRef.current?.pause() }}
        />
      )}
    </div>
  )
}
