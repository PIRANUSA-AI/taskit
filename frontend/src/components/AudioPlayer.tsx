import { useEffect, useRef, useState } from 'react'
import { Play, Pause } from '@phosphor-icons/react'

interface Props {
  src: string
  mimeType?: string
  audioRef?: { current: HTMLAudioElement | null }
  onTimeUpdate?: (time: number) => void
  onPlayingChange?: (playing: boolean) => void
  onDuration?: (dur: number) => void
}

const BAR_COUNT = 48

export function AudioPlayer({ src, mimeType, audioRef: externalRef, onTimeUpdate, onPlayingChange, onDuration }: Props) {
  const internalRef = useRef<HTMLAudioElement>(null)
  const audioRef = externalRef ?? internalRef
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const animRef = useRef<number>(0)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const ctxRef = useRef<AudioContext | null>(null)

  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)
  const [rate, setRate] = useState(1)

  const rates = [0.75, 1, 1.25, 1.5, 2, 3]

  const changeRate = (r: number) => {
    setRate(r)
    if (audioRef.current) audioRef.current.playbackRate = r
  }

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onTime = () => {
      setCurrent(audio.currentTime)
      onTimeUpdate?.(audio.currentTime)
    }
    const onMeta = () => { setDuration(audio.duration); setReady(true); onDuration?.(audio.duration) }
    const onEnd = () => { setPlaying(false); onPlayingChange?.(false) }
    const onPlay = () => { setPlaying(true); onPlayingChange?.(true) }
    const onPause = () => { setPlaying(false); onPlayingChange?.(false) }

    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnd)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)

    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnd)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
    }
  }, [])

  useEffect(() => {
    if (!ready || !audioRef.current || !canvasRef.current || !wrapRef.current) return
    const audio = audioRef.current
    const canvas = canvasRef.current

    const resize = () => {
      const rect = wrapRef.current!.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(wrapRef.current)

    let ctx = ctxRef.current
    if (!ctx) {
      ctx = new AudioContext()
      ctxRef.current = ctx
      const source = ctx.createMediaElementSource(audio)
      sourceRef.current = source
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
      analyserRef.current = analyser
      source.connect(analyser)
      analyser.connect(ctx.destination)
    }

    const a = analyserRef.current!
    const bufferLength = a.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const draw = () => {
      animRef.current = requestAnimationFrame(draw)
      a.getByteFrequencyData(dataArray)

      const W = canvas.width
      const H = canvas.height
      const dpr = window.devicePixelRatio || 1
      const ctx2 = canvas.getContext('2d')!
      ctx2.clearRect(0, 0, W, H)

      const gap = 2 * dpr
      const barW = (W - gap * (BAR_COUNT + 1)) / BAR_COUNT

      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.floor((i / BAR_COUNT) * bufferLength)
        const val = dataArray[idx] / 255
        const barH = Math.max(3 * dpr, val * H * 0.85)

        const x = gap + i * (barW + gap)
        const y = H - barH

        const hue = 220 + val * 50
        const alpha = 0.3 + val * 0.7

        ctx2.beginPath()
        ctx2.roundRect(x, y, barW, barH, [3 * dpr])
        ctx2.fillStyle = `hsla(${hue}, 85%, 72%, ${alpha})`
        ctx2.fill()

        if (val > 0.15) {
          ctx2.shadowColor = `hsla(${hue}, 100%, 75%, ${alpha * 0.6})`
          ctx2.shadowBlur = 12 * dpr
          ctx2.fill()
          ctx2.shadowBlur = 0
        }
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(animRef.current)
      ro.disconnect()
    }
  }, [ready])

  const toggle = () => {
    const audio = audioRef.current
    if (!audio) return
    if (ctxRef.current?.state === 'suspended') ctxRef.current.resume()
    if (audio.paused) audio.play()
    else audio.pause()
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current
    if (!audio || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * duration
  }

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0

  return (
    <div className="mb-6 card overflow-hidden">
      <div className="relative bg-gradient-to-r from-navy via-indigo-800 to-navy px-4 pt-4 pb-3">
        <div className="flex items-center gap-4">
          <button
            onClick={toggle}
            className="grid place-items-center w-12 h-12 rounded-full bg-white/15 hover:bg-white/25 text-white flex-shrink-0 transition-all active:scale-90 hover:shadow-lg hover:shadow-white/10"
            aria-label={playing ? 'Jeda' : 'Putar'}
          >
            {playing ? <Pause size={20} weight="fill" /> : <Play size={20} weight="fill" />}
          </button>

          <div
            ref={wrapRef}
            className="flex-1 h-16 md:h-20 relative"
          >
            <canvas
              ref={canvasRef}
              className="w-full h-full"
            />
            {!ready && (
              <div className="absolute inset-0 overflow-hidden">
                <div
                  className="absolute w-32 h-32 -bottom-8 -left-4 rounded-full bg-indigo-300/20 blur-2xl"
                  style={{ animation: 'smoke-drift 8s ease-in-out infinite' }}
                />
                <div
                  className="absolute w-40 h-40 -bottom-10 left-1/3 rounded-full bg-violet-300/15 blur-2xl"
                  style={{ animation: 'smoke-drift-2 11s ease-in-out infinite 2s' }}
                />
                <div
                  className="absolute w-28 h-28 -bottom-6 right-4 rounded-full bg-indigo-200/20 blur-2xl"
                  style={{ animation: 'smoke-drift-3 9s ease-in-out infinite 4s' }}
                />
                <div
                  className="absolute w-36 h-36 -bottom-12 left-1/2 rounded-full bg-white/10 blur-3xl"
                  style={{ animation: 'smoke-drift 12s ease-in-out infinite 1s' }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-[11px] text-white/30 font-medium tracking-wide">
                    Memuat audio...
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="hidden sm:flex items-center gap-0.5">
              {rates.map((r) => (
                <button
                  key={r}
                  onClick={() => changeRate(r)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                    rate === r ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {r}x
                </button>
              ))}
            </div>
            <span className="text-xs text-white/50 tabular-nums font-mono">
              {fmt(current)} / {fmt(duration)}
            </span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3">
          <div
            className="flex-1 h-3 bg-white/10 rounded-full cursor-pointer group relative"
            onClick={seek}
          >
            <div
              className="h-full bg-gradient-to-r from-indigo-300 to-violet-300 rounded-full transition-all relative"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-md shadow-indigo-500/60 scale-0 group-hover:scale-100 transition-transform" />
            </div>
          </div>
        </div>
      </div>

      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous">
        <source src={src} type={mimeType ?? 'audio/mpeg'} />
      </audio>
    </div>
  )
}
