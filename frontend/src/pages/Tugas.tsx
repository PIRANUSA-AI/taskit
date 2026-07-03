import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Check, WarningCircle, ListChecks, ArrowLeft } from '@phosphor-icons/react'
import { ApiError, api, type MyTasksResponse, type TaskGroupItem } from '../lib/api'
import { LoadingScreen } from '../components/LoadingScreen'
import { formatRelativeTime } from '../lib/format'

const CONFIDENCE_THRESHOLD = 0.55

export default function Tugas() {
  const [data, setData] = useState<MyTasksResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hideDone, setHideDone] = useState(false)

  const load = () => {
    setError(null)
    api
      .get<MyTasksResponse>('/auth/me/tasks')
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Gagal memuat tugas'))
  }

  useEffect(load, [])

  const toggle = async (item: TaskGroupItem, nextDone: boolean) => {
    if (!data) return
    setData({
      ...data,
      openCount: data.openCount + (nextDone ? -1 : 1),
      groups: data.groups.map((g) => ({
        ...g,
        items: g.items.map((it) => (it.id === item.id ? { ...it, done: nextDone } : it)),
      })),
    })
    try {
      await api.patch(`/auth/me/tasks`, { itemId: item.id, done: nextDone })
    } catch {
      load()
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-8 pt-10">
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={load} className="btn-ghost mt-4">Coba lagi</button>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 md:px-8 pt-8 md:pt-12 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-32">
        <header className="mb-6 md:mb-8">
          <div className="skeleton h-3 w-20 rounded mb-2" />
          <div className="skeleton h-9 w-48 rounded-lg mb-2" />
          <div className="skeleton h-4 w-36 rounded" />
        </header>
        {[0, 1, 2].map((i) => (
          <div key={i} className="card p-5 mb-3">
            <div className="skeleton h-5 w-1/2 rounded-lg mb-4" />
            <div className="space-y-3">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const visibleGroups = data.groups
    .map((g) => ({ ...g, items: hideDone ? g.items.filter((i) => !i.done) : g.items }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-8 pt-8 md:pt-12 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-32">
      <header className="flex items-start justify-between gap-4 mb-6 md:mb-8">
        <div className="min-w-0">
          <p className="eyebrow mb-2">Tugas saya</p>
          <h1 className="text-3xl md:text-4xl tracking-tightest font-semibold text-navy">
            {data.user.displayName}
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted tabular">
            {data.openCount} tugas terbuka · {data.totalCount} total
          </p>
        </div>
      </header>

      <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer select-none mb-6">
        <input
          type="checkbox"
          checked={hideDone}
          onChange={(e) => setHideDone(e.target.checked)}
          className="rounded border-slate-300 text-brand focus:ring-brand/20"
        />
        Sembunyikan tugas yang sudah selesai
      </label>

      <div className="space-y-5">
        {visibleGroups.length === 0 ? (
          <div className="card p-12 text-center">
            <Check weight="duotone" size={40} className="mx-auto text-emerald-500" />
            <p className="mt-3 text-sm text-ink-muted">
              {data.totalCount === 0 ? 'Belum ada tugas untuk kamu.' : 'Semua tugas sudah selesai. Mantap!'}
            </p>
          </div>
        ) : (
          visibleGroups.map((g) => (
            <motion.section
              key={g.jobId}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4 sm:p-5"
            >
              <div className="flex items-baseline justify-between gap-3 mb-3">
                <Link
                  to={`/job/${g.jobId}`}
                  className="font-semibold truncate text-[15px] text-navy hover:text-brand transition-colors"
                >
                  {g.title ?? g.filename}
                </Link>
                <span className="text-[11px] text-slate-400 flex-shrink-0 tabular">
                  {formatRelativeTime(g.completedAt ?? g.createdAt)}
                </span>
              </div>
              <ul className="divide-y divide-slate-100">
                {g.items.map((it) => (
                  <li key={it.id} className="flex items-start gap-3 py-2.5">
                    <button
                      onClick={() => toggle(it, !it.done)}
                      className={`mt-0.5 grid place-items-center w-5 h-5 rounded-md border flex-shrink-0 transition ${
                        it.done
                          ? 'bg-brand border-brand text-white'
                          : 'border-slate-300 text-transparent hover:border-brand'
                      }`}
                      aria-label={it.done ? 'Tandai belum selesai' : 'Tandai selesai'}
                    >
                      <Check size={12} weight="bold" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm leading-relaxed ${
                          it.done ? 'line-through text-slate-400' : 'text-ink'
                        }`}
                      >
                        {it.task}
                      </p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {it.due && (
                          <span className="text-[11px] text-ink-muted tabular">Tenggat: {it.due}</span>
                        )}
                        {it.confidence < CONFIDENCE_THRESHOLD && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                            <WarningCircle size={10} weight="fill" />
                            Perlu ditinjau
                          </span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.section>
          ))
        )}
      </div>
    </div>
  )
}
