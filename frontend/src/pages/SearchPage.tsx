import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { MagnifyingGlass, ArrowLeft, X } from '@phosphor-icons/react'
import { api } from '../lib/api'
import { formatRelativeTime } from '../lib/format'

interface MatchSegment {
  speaker: string
  text: string
  start: string
  end: string
}

interface SearchResult {
  id: string
  filename: string
  title: string | null
  createdAt: string
  completedAt: string | null
  durationSec: number | null
  matches: MatchSegment[]
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300)
    return () => clearTimeout(timer)
  }, [query])

  useEffect(() => {
    if (debouncedQuery.length < 2) { setResults([]); setSearched(false); return }
    setLoading(true)
    const q = debouncedQuery
    api.get<{ results: SearchResult[]; query: string }>(`/search?q=${encodeURIComponent(q)}`)
      .then((r) => {
        if (r.query === debouncedQuery) {
          setResults(r.results)
          setSearched(true)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [debouncedQuery])

  const highlight = (text: string) => {
    if (!query.trim()) return text
    const re = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    const parts = text.split(re)
    return parts.map((p, i) =>
      re.test(p) ? <mark key={i} className="bg-yellow-200/70 rounded px-0.5 text-ink">{p}</mark> : p
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-8 pt-8 md:pt-12 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-32">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-navy mb-4">
        <ArrowLeft size={14} />
        Beranda
      </Link>

      <div className="relative mb-6">
        <MagnifyingGlass size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari di semua transkrip…"
          className="input pl-11 pr-20 text-lg"
          autoFocus
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && !loading && (
            <button
              onClick={() => setQuery('')}
              className="grid place-items-center w-7 h-7 rounded-md text-slate-400 hover:text-navy hover:bg-slate-100 transition-colors"
              aria-label="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
          {loading && (
            <div className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
          )}
        </div>
      </div>

      {searched && (
        <p className="text-sm text-ink-muted mb-4">
          {results.reduce((sum, r) => sum + r.matches.length, 0)} kecocokan di {results.length} transkrip
        </p>
      )}

      <div className="space-y-4">
        {results.length === 0 && searched && (
          <div className="card p-12 text-center">
            <MagnifyingGlass size={40} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm text-ink-muted">Tidak ada hasil untuk "{query}"</p>
          </div>
        )}

        {results.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04 }}
          >
            <Link
              to={`/job/${r.id}`}
              className="card p-4 sm:p-5 block hover:bg-paper transition-colors group"
            >
              <h3 className="font-semibold text-[15px] text-navy truncate group-hover:text-brand transition-colors">
                {highlight(r.title ?? r.filename)}
              </h3>
              <p className="mt-1 text-xs text-ink-muted tabular mb-3">
                {r.createdAt ? formatRelativeTime(r.createdAt) : null}
                {r.durationSec ? ` | ${Math.floor(r.durationSec / 60)}m ${Math.floor(r.durationSec % 60)}d` : ''}
              </p>
              <div className="space-y-1.5">
                {r.matches.slice(0, 3).map((m, mi) => (
                  <div key={mi} className="flex items-start gap-2 text-sm">
                    <span className="text-[11px] text-slate-400 tabular mt-0.5 flex-shrink-0 font-mono">
                      {m.start}
                    </span>
                    <span className="text-[11px] font-medium text-brand-deep bg-brand-soft px-1.5 py-0.5 rounded flex-shrink-0">
                      {m.speaker}
                    </span>
                    <p className="text-ink-muted leading-relaxed line-clamp-2">
                      {highlight(m.text)}
                    </p>
                  </div>
                ))}
                {r.matches.length > 3 && (
                  <p className="text-xs text-ink-muted/60">+{r.matches.length - 3} kecocokan lainnya</p>
                )}
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
