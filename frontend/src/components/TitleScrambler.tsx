import { useEffect, useRef, useState } from 'react'

interface Props {
  /** Original (filename) text — shown first. */
  from: string
  /** Target contextual title. If empty/missing, just shows `from` statically. */
  to: string | null | undefined
  /** Stagger delay (ms) before the scramble begins. */
  delay?: number
  /** Total animation duration (ms). */
  duration?: number
  /** Whether to play at all (e.g. disable on reload for accessibility). */
  play?: boolean
  className?: string
}

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&@*<>!?/\\|+=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'

/**
 * Game-style "decryption" title reveal: starts at the filename, then each
 * character scrambles through random glyphs and locks onto the contextual
 * title one-by-one (left-to-right), with a brief glitch/shake on the wrapper.
 *
 * If no title is available, the filename is rendered statically.
 *
 * Respects prefers-reduced-motion: skips the scramble and snaps to the result.
 */
export function TitleScrambler({
  from,
  to,
  delay = 120,
  duration = 1100,
  play = true,
  className,
}: Props) {
  const target = to && to.trim().length > 0 ? to.trim() : from
  const shouldAnimate =
    play && to && to.trim().length > 0 && to.trim() !== from

  const [display, setDisplay] = useState(shouldAnimate ? from : target)
  const [shaking, setShaking] = useState(false)
  const rafRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)

  useEffect(() => {
    if (!shouldAnimate) {
      setDisplay(target)
      return

    }
    // Honor reduced-motion preference: snap instantly.
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      setDisplay(target)
      return
    }

    let cancelled = false

    const begin = () => {
      if (cancelled) return
      setShaking(true)
      startRef.current = null

      const tick = (now: number) => {
        if (cancelled) return
        if (startRef.current === null) startRef.current = now
        const elapsed = now - startRef.current
        const progress = Math.min(elapsed / duration, 1)

        // Number of leading characters already "locked in" to target.
        const locked = Math.floor(progress * target.length)
        let out = ''
        for (let i = 0; i < target.length; i++) {
          if (i < locked) {
            out += target[i]
          } else {
            // Scramble: random glyph. Pad shorter positions if target shorter than from.
            out += GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          }
        }
        setDisplay(out)

        if (progress < 1) {
          rafRef.current = requestAnimationFrame(tick)
        } else {
          setDisplay(target)
          setShaking(false)
        }
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    const timer = window.setTimeout(begin, delay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, to, from, delay, duration, play])

  if (!shouldAnimate) {
    return <span className={className}>{target}</span>
  }

  return (
    <span
      className={`${className ?? ''} relative inline-block`}
      style={
        shaking
          ? {
              animation: 'title-glitch 520ms steps(2) 1',
              textShadow:
                '2px 0 rgba(99,102,241,0.45), -2px 0 rgba(244,63,94,0.40)',
            }
          : undefined
      }
      title={from}
    >
      {display}
    </span>
  )
}
