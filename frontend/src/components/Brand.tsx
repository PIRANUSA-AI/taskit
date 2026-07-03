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
        <rect x="9" y="6" width="5" height="20" rx="2.5" fill="#FFFFFF" />
        <path
          d="M14 8.5 H18.5 C22.6 8.5 25.5 11 25.5 14 C25.5 17 22.6 19.5 18.5 19.5 H14"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
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
          PIRANUSA
        </span>
      )}
    </span>
  )

  if (!to) return content
  return content
}
