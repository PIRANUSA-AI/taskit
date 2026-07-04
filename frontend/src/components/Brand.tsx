import { motion } from 'framer-motion'

interface BrandMarkProps {
  size?: number
  rounded?: number
  className?: string
  animated?: boolean
}

export function BrandMark({ size = 32, rounded, className, animated = false }: BrandMarkProps) {
  const r = rounded ?? size * 0.28
  const Wrap: typeof motion.div = animated ? motion.div : (motion.div as never)
  return (
    <Wrap
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: r,
        background: 'linear-gradient(140deg, #1E1B4B 0%, #312E81 55%, #4F46E5 100%)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(30,27,75,0.18)',
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <svg width={size * 0.56} height={size * 0.56} viewBox="0 0 32 32" fill="none" style={{ display: 'block' }}>
        <rect x="6" y="7" width="20" height="4.5" rx="2.25" fill="#FFFFFF" />
        <rect x="13" y="7" width="6" height="18" rx="3" fill="#FFFFFF" />
      </svg>
    </Wrap>
  )
}

interface BrandProps {
  size?: number
  showWord?: boolean
  wordClassName?: string
  to?: string
}

export function Brand({ size = 32, showWord = true, wordClassName, to }: BrandProps) {
  const content = (
    <span className="inline-flex items-center gap-2.5 select-none">
      <BrandMark size={size} />
      {showWord && (
        <span
          className={`font-display font-semibold tracking-tight text-navy ${wordClassName ?? ''}`}
          style={{ fontSize: size * 0.5 }}
        >
          TASKIT
        </span>
      )}
    </span>
  )

  if (!to) return content
  return content
}
