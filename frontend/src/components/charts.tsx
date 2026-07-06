import { motion, useReducedMotion } from 'framer-motion'

interface LinePoint {
  date: string
  count: number
}

/**
 * Lightweight SVG line chart. No external charting lib — bundle stays small
 * and the visual stays bespoke. Honors reduced motion (draws instantly).
 */
export function LineChart({
  points,
  height = 140,
  color = '#6366F1',
  label,
}: {
  points: LinePoint[]
  height?: number
  color?: string
  label?: string
}) {
  const reduce = useReducedMotion()
  const width = 600
  const padX = 8
  const padY = 16
  const max = Math.max(1, ...points.map((p) => p.count))
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  if (points.length === 0) {
    return <div className="text-xs text-ink-muted">Belum ada data.</div>
  }

  const stepX = points.length > 1 ? innerW / (points.length - 1) : 0
  const yFor = (v: number) => padY + innerH - (v / max) * innerH

  const path = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${padX + i * stepX} ${yFor(p.count)}`)
    .join(' ')
  const areaPath = `${path} L ${padX + (points.length - 1) * stepX} ${padY + innerH} L ${padX} ${padY + innerH} Z`

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
      preserveAspectRatio="none"
      role="img"
      aria-label={label ?? 'Tren'}
    >
      <defs>
        <linearGradient id="chartFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* Horizontal gridlines */}
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={padX}
          x2={width - padX}
          y1={padY + innerH * t}
          y2={padY + innerH * t}
          stroke="#E2E8F0"
          strokeWidth="1"
          strokeDasharray="2 4"
        />
      ))}
      <motion.path
        d={areaPath}
        fill="url(#chartFill)"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.3 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* End point marker */}
      {points.length > 0 && (
        <motion.circle
          cx={padX + (points.length - 1) * stepX}
          cy={yFor(points[points.length - 1].count)}
          r="4"
          fill={color}
          stroke="white"
          strokeWidth="2"
          initial={reduce ? false : { scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.9, type: 'spring', stiffness: 280, damping: 18 }}
        />
      )}
    </svg>
  )
}

interface BarItem {
  label: string
  value: number
  sub?: string
}

export function BarChart({
  items,
  color = '#6366F1',
  label,
}: {
  items: BarItem[]
  color?: string
  label?: string
}) {
  const reduce = useReducedMotion()
  const max = Math.max(1, ...items.map((i) => i.value))

  return (
    <div className="space-y-3" role="img" aria-label={label ?? 'Bar chart'}>
      {items.map((item, i) => {
        const ratio = item.value / max
        return (
          <div key={item.label} className="flex items-center gap-3">
            <span className="text-xs font-medium text-ink truncate w-24 flex-shrink-0">{item.label}</span>
            <div className="flex-1 relative">
              <div className="h-8 bg-paper rounded-lg overflow-hidden relative">
                <motion.div
                  className="h-full rounded-lg"
                  style={{ background: `linear-gradient(135deg, ${color}, ${color}99)` }}
                  initial={reduce ? false : { width: 0 }}
                  animate={{ width: `${ratio * 100}%` }}
                  transition={{ duration: 0.8, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-baseline gap-1">
                <span className="text-sm font-bold text-navy tabular leading-none">{item.value}</span>
                {item.sub && <span className="text-[11px] text-ink-muted font-medium">{item.sub}</span>}
              </div>
            </div>
          </div>
        )
      })}
      {items.length === 0 && <p className="text-xs text-ink-muted">Belum ada data.</p>}
    </div>
  )
}

export function DonutProgress({
  value,
  size = 120,
  thickness = 12,
  color = '#6366F1',
  label,
}: {
  value: number
  size?: number
  thickness?: number
  color?: string
  label?: string
}) {
  const reduce = useReducedMotion()
  const r = (size - thickness) / 2
  const c = 2 * Math.PI * r
  const clamped = Math.max(0, Math.min(1, value))
  const offset = c * (1 - clamped)

  return (
    <div className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#E2E8F0"
          strokeWidth={thickness}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={reduce ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div>
          <p className="text-2xl font-semibold text-navy tabular">{Math.round(clamped * 100)}%</p>
          {label && <p className="text-[10px] text-ink-muted uppercase tracking-wide mt-0.5">{label}</p>}
        </div>
      </div>
    </div>
  )
}
