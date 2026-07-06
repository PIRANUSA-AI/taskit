import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, MagnifyingGlass, FunnelSimple, X } from '@phosphor-icons/react'
import { api, type JobSummary } from '../lib/api'
import { useEffect } from 'react'
import { formatBytes, formatDuration, formatRelativeTime } from '../lib/format'
import { LoadingScreen } from '../components/LoadingScreen'

type StatusFilter = 'all' | 'completed' | 'processing' | 'failed'
type Sort = 'newest' | 'oldest' | 'longest'

export default function Riwayat() {
  const [jobs, setJobs] = useState<JobSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [sort, setSort] = useState<Sort>('newest')

  useEffect(() => {
    api
      .get<{ jobs: JobSummary[]; hasMore?: boolean; nextCursor?: string | null }>('/jobs')
      .then((r) => {
        setJobs(r.jobs)
        setHasMore(r.hasMore ?? false)
        setNextCursor(r.nextCursor ?? null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Gagal memuat riwayat'))
  }, [])

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const r = await api.get<{ jobs: JobSummary[]; hasMore?: boolean; nextCursor?: string | null }>(
        `/jobs?cursor=${encodeURIComponent(nextCursor)}`
      )
      setJobs((prev) => (prev ? [...prev, ...r.jobs] : r.jobs))
      setHasMore(r.hasMore ?? false)
      setNextCursor(r.nextCursor ?? null)
    } catch (err) {
      console.error('Gagal memuat lebih banyak:', err)
    } finally {
      setLoadingMore(false)
    }
  }

  const filtered = useMemo(() => {
    if (!jobs) return []
    let out = jobs
    if (query.trim()) {
      const q = query.toLowerCase()
      out = out.filter(
        (j) => (j.title ?? j.filename).toLowerCase().includes(q)
      )
    }
    if (status !== 'all') {
      out = out.filter((j) =>
        status === 'completed'
          ? j.status === 'completed'
          : status === 'processing'
          ? ['pending', 'uploading', 'queued', 'transcribing'].includes(j.status)
          : j.status === 'failed' || j.status === 'cancelled'
      )
    }
    const sorted = [...out]
    if (sort === 'newest') sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    if (sort === 'oldest') sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt))
    if (sort === 'longest')
      sorted.sort((a, b) => (b.durationSec ?? 0) - (a.durationSec ?? 0))
    return sorted
  }, [jobs, query, status, sort])

  if (error) {
    return (
      <div className="mx-auto max-w-4xl px-4 md:px-8 pt-10">
        <p className="text-sm text-red-600">{error}</p>
        <Link to="/" className="btn-ghost mt-4">
          <ArrowLeft size={14} weight="bold" /> Beranda
        </Link>
      </div>
    )
  }

  if (jobs === null) {
    return (
      <div className="mx-auto max-w-5xl px-4 md:px-8 pt-8 md:pt-12 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-32">
        <header className="mb-6 md:mb-8">
          <div className="skeleton h-3 w-20 rounded mb-2" />
          <div className="skeleton h-9 w-64 rounded-lg mb-2" />
          <div className="skeleton h-4 w-32 rounded" />
        </header>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="card p-5 mb-3">
            <div className="skeleton h-5 w-3/4 rounded-lg mb-3" />
            <div className="skeleton h-3 w-1/2 rounded mb-2" />
            <div className="flex gap-2 mt-3">
              <div className="skeleton h-5 w-16 rounded-full" />
              <div className="skeleton h-5 w-20 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-4 md:px-8 pt-8 md:pt-12 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-32">
      <header className="mb-6 md:mb-8">
        <p className="eyebrow mb-2">Riwayat</p>
        <h1 className="text-3xl md:text-4xl tracking-tightest font-semibold text-navy">
          Semua transkrip
        </h1>
        <p className="mt-1.5 text-sm text-ink-muted tabular">{jobs.length} total transkrip</p>
      </header>

      {/* Filters */}
      <div className="card p-3 md:p-4 mb-5 flex flex-col md:flex-row md:items-center gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari transkrip…"
            className="w-full rounded-lg border border-slate-200 bg-paper pl-9 pr-9 py-2 text-sm focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-7 h-7 rounded-md text-slate-400 hover:text-navy hover:bg-slate-100"
              aria-label="Hapus pencarian"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <FunnelSimple size={14} className="text-slate-400 flex-shrink-0" />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusFilter)}
            className="text-xs font-medium bg-paper border border-slate-200 rounded-lg px-2 py-2 focus:border-brand focus:outline-none"
          >
            <option value="all">Semua status</option>
            <option value="completed">Selesai</option>
            <option value="processing">Proses</option>
            <option value="failed">Gagal</option>
          </select>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="text-xs font-medium bg-paper border border-slate-200 rounded-lg px-2 py-2 focus:border-brand focus:outline-none"
          >
            <option value="newest">Terbaru</option>
            <option value="oldest">Terlama</option>
            <option value="longest">Terpanjang</option>
          </select>
        </div>
      </div>

      {/* Desktop table / mobile cards */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <MagnifyingGlass weight="duotone" size={32} className="mx-auto text-brand" />
          <p className="mt-3 text-sm text-ink font-semibold">Tidak ada transkrip yang cocok.</p>
          <p className="text-xs text-ink-muted mt-1">Coba ubah filter atau pencarian.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-paper border-b border-slate-200">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-ink-muted">
                  <th className="px-4 py-3">Judul</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3 text-right">Durasi</th>
                  <th className="px-4 py-3 text-right">Ukuran</th>
                  <th className="px-4 py-3 text-center">Pembicara</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((job, i) => (
                  <motion.tr
                    key={job.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: Math.min(i * 0.015, 0.3) }}
                    className="hover:bg-paper transition-colors cursor-pointer"
                  >
                    <td className="px-4 py-3">
                      <Link to={`/job/${job.id}`} className="font-medium text-ink hover:text-brand-deep truncate block max-w-md">
                        {job.title ?? job.filename}
                      </Link>
                      <span className="text-xs text-ink-muted">{job.filename}</span>
                    </td>
                    <td className="px-4 py-3 text-ink-muted tabular whitespace-nowrap">
                      {formatRelativeTime(job.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-muted tabular">
                      {job.durationSec ? formatDuration(job.durationSec) : '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-ink-muted tabular">
                      {job.sizeBytes ? formatBytes(job.sizeBytes) : '—'}
                    </td>
                    <td className="px-4 py-3 text-center text-ink-muted tabular">
                      {job.speakerCount && job.speakerCount > 0 ? job.speakerCount : '—'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusChip status={job.status} />
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filtered.map((job, i) => (
              <motion.div
                key={job.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.02, 0.3) }}
              >
                <Link
                  to={`/job/${job.id}`}
                  className="card p-4 flex items-center gap-3 active:scale-[0.99] transition-transform"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">
                      {job.title ?? job.filename}
                    </p>
                    <p className="text-xs text-ink-muted mt-1 tabular">
                      {[
                        formatRelativeTime(job.createdAt),
                        job.durationSec ? formatDuration(job.durationSec) : null,
                        job.sizeBytes ? formatBytes(job.sizeBytes) : null,
                      ].filter(Boolean).join(' | ')}
                    </p>
                  </div>
                  <StatusChip status={job.status} />
                </Link>
              </motion.div>
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-6">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn-ghost text-sm font-medium px-6 py-2"
              >
                {loadingMore ? 'Memuat…' : 'Muat lebih banyak'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function StatusChip({ status }: { status: JobSummary['status'] }) {
  if (status === 'completed') {
    return <span className="chip bg-emerald-50 text-emerald-700">Selesai</span>
  }
  if (status === 'failed' || status === 'cancelled') {
    return <span className="chip bg-red-50 text-red-700">Gagal</span>
  }
  return <span className="chip bg-brand-soft text-brand-deep">Proses</span>
}
