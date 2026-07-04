import { motion } from 'framer-motion'
import { memo } from 'react'

interface Props {
  bars?: number
  className?: string
  color?: string
  active?: boolean
}

export const WaveformBars = memo(function WaveformBars({
  bars = 7,
  className = 'w-32 h-16',
  color = '#6366F1',
  active = true,
}: Props) {
  return (
    <div
      className={`flex items-center justify-center gap-1.5 ${className}`}
      aria-label="audio waveform"
    >
      {Array.from({ length: bars }).map((_, i) => {
        const offset = i * 0.1
        return (
          <motion.span
            key={i}
            className="rounded-full"
            style={{
              background: color,
              width: 3,
            }}
            initial={{ height: 6 }}
            animate={
              active
                ? {
                    height: [6, 22 + ((i * 7) % 20), 10, 30 - ((i * 5) % 16), 6],
                  }
                : { height: 8 }
            }
            transition={{
              duration: 1.4,
              repeat: active ? Infinity : 0,
              ease: 'easeInOut',
              delay: offset,
            }}
          />
        )
      })}
    </div>
  )
})
