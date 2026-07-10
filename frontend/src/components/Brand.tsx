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
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12), 0 2px 6px rgba(30,27,75,0.18)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <img src="/icon-512.svg" alt="" aria-hidden="true" style={{ width: '100%', height: '100%', display: 'block' }} />
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
          Rekapin
        </span>
      )}
    </span>
  )

  if (!to) return content
  return content
}
