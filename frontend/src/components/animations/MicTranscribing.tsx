import { motion } from 'framer-motion'
import { memo } from 'react'

interface Props {
  size?: number
  className?: string
}

export const MicTranscribing = memo(function MicTranscribing({
  size = 112,
  className = '',
}: Props) {
  return (
    <div
      className={`relative grid place-items-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer pulsing ring */}
      <motion.span
        className="absolute rounded-full border-2 border-brand/20"
        style={{ width: size, height: size }}
        initial={{ scale: 1, opacity: 0.5 }}
        animate={{ scale: 1.12, opacity: 0 }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
      />

      {/* Soft background glow */}
      <motion.div
        className="absolute rounded-full bg-brand-soft"
        style={{ width: size * 0.85, height: size * 0.85 }}
        animate={{ scale: [1, 1.03, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Inner circle with border */}
      <motion.div
        className="absolute rounded-full bg-white shadow-sm border border-slate-200"
        style={{ width: size * 0.78, height: size * 0.78 }}
      >
        {/* Waveform bars inside */}
        <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              className="rounded-full"
              style={{
                width: 3,
                background: i % 2 === 0
                  ? 'linear-gradient(to top, #6366F1, #818CF8)'
                  : 'linear-gradient(to top, #4F46E5, #6366F1)',
              }}
              animate={{
                height: [10, 24 + ((i * 5) % 18), 14, 32 - ((i * 3) % 14), 10],
              }}
              transition={{
                duration: 1.6 + (i * 0.1),
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Bottom dots */}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1 h-1 rounded-full bg-brand"
            animate={{ opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
            transition={{
              duration: 1.2,
              repeat: Infinity,
              delay: i * 0.2,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>
    </div>
  )
})
