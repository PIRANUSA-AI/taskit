import { Play, Pause, X } from '@phosphor-icons/react'

interface Props {
  audioRef: { current: HTMLAudioElement | null }
  playing: boolean
  currentTime: number
  duration: number
  filename: string
  onClose: () => void
}

const RATES = [0.75, 1, 1.25, 1.5, 2, 3]

export function MiniPlayer({ audioRef, playing, currentTime, duration, filename, onClose }: Props) {
  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return '0:00'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play()
    else audio.pause()
  }

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  const changeRate = (r: number) => {
    if (audioRef.current) audioRef.current.playbackRate = r
  }

  const getRate = () => audioRef.current?.playbackRate ?? 1

  return (
    <div className="fixed top-0 inset-x-0 z-50 pointer-events-none">
      <div className="bg-navy/95 backdrop-blur-xl border-b border-indigo-500/20 shadow-lg shadow-indigo-900/20 pointer-events-auto">
        <div className="mx-auto max-w-6xl flex items-center gap-3 px-4 py-2.5">
          <button
            onClick={toggle}
            className="grid place-items-center w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex-shrink-0 transition-all active:scale-90"
            aria-label={playing ? 'Jeda' : 'Putar'}
          >
            {playing ? <Pause size={14} weight="fill" /> : <Play size={14} weight="fill" />}
          </button>

          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-0.5">
              {[3, 5, 7, 9, 7, 5, 3].map((h, i) => (
                <span
                  key={i}
                  className="w-0.5 bg-indigo-300/60 rounded-full"
                  style={{
                    height: playing ? h : 3,
                    animation: playing ? `pulse ${1.2 + i * 0.1}s ease-in-out infinite` : 'none',
                    animationDelay: `${i * 0.12}s`,
                  }}
                />
              ))}
            </div>
            <span className="text-xs text-white/70 font-medium truncate ml-1">{filename}</span>
          </div>

          <div className="hidden sm:flex items-center gap-3">
            <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-400 to-violet-400 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-[11px] text-white/50 tabular-nums font-mono flex-shrink-0">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-0.5">
            {RATES.map((r) => (
              <button
                key={r}
                onClick={() => changeRate(r)}
                className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                  getRate() === r ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {r}x
              </button>
            ))}
          </div>

          <button
            onClick={onClose}
            className="grid place-items-center w-7 h-7 rounded-full text-white/40 hover:text-white hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Tutup"
          >
            <X size={14} weight="bold" />
          </button>
        </div>
      </div>
    </div>
  )
}
