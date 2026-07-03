export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes && bytes !== 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0
  let n = bytes
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds && seconds !== 0) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}j ${m}m`
  if (m > 0) return `${m}m ${s}d`
  return `${s}d`
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  const diff = Date.now() - date.getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 0) return 'baru saja'
  if (minutes < 1) return 'baru saja'
  if (minutes < 60) return `${minutes}m lalu`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}j lalu`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}h lalu`
  return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function parseTimestamp(ts: string): number {
  const parts = ts.split(':').map(Number)
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return Number(parts[0]) || 0
}

// Chromatic palette — each speaker gets a distinct hue so per-person groups
// are visually separable at a glance (per the actionable-items UX requirement).
// `chip` = speaker label pill classes; `accent` = border/dot/header tint.
const SPEAKER_PALETTE = [
  {
    chip: 'bg-indigo-500 text-white border-indigo-500',
    accent: 'border-indigo-300 bg-indigo-50',
    dot: 'bg-indigo-500',
    text: 'text-indigo-700',
    ring: 'ring-indigo-200',
  },
  {
    chip: 'bg-rose-500 text-white border-rose-500',
    accent: 'border-rose-300 bg-rose-50',
    dot: 'bg-rose-500',
    text: 'text-rose-700',
    ring: 'ring-rose-200',
  },
  {
    chip: 'bg-emerald-500 text-white border-emerald-500',
    accent: 'border-emerald-300 bg-emerald-50',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700',
    ring: 'ring-emerald-200',
  },
  {
    chip: 'bg-amber-500 text-white border-amber-500',
    accent: 'border-amber-300 bg-amber-50',
    dot: 'bg-amber-500',
    text: 'text-amber-700',
    ring: 'ring-amber-200',
  },
  {
    chip: 'bg-sky-500 text-white border-sky-500',
    accent: 'border-sky-300 bg-sky-50',
    dot: 'bg-sky-500',
    text: 'text-sky-700',
    ring: 'ring-sky-200',
  },
  {
    chip: 'bg-fuchsia-500 text-white border-fuchsia-500',
    accent: 'border-fuchsia-300 bg-fuchsia-50',
    dot: 'bg-fuchsia-500',
    text: 'text-fuchsia-700',
    ring: 'ring-fuchsia-200',
  },
  {
    chip: 'bg-teal-500 text-white border-teal-500',
    accent: 'border-teal-300 bg-teal-50',
    dot: 'bg-teal-500',
    text: 'text-teal-700',
    ring: 'ring-teal-200',
  },
  {
    chip: 'bg-orange-500 text-white border-orange-500',
    accent: 'border-orange-300 bg-orange-50',
    dot: 'bg-orange-500',
    text: 'text-orange-700',
    ring: 'ring-orange-200',
  },
]

export interface SpeakerStyle {
  chip: string
  accent: string
  dot: string
  text: string
  ring: string
}

export function speakerStyle(label: string): SpeakerStyle {
  const match = label.match(/(\d+)/)
  const n = match ? Number(match[1]) - 1 : 0
  return SPEAKER_PALETTE[((n % SPEAKER_PALETTE.length) + SPEAKER_PALETTE.length) % SPEAKER_PALETTE.length]
}

export function speakerColor(label: string): string {
  return speakerStyle(label).chip
}
