import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, WarningCircle, ListChecks } from '@phosphor-icons/react'
import { ApiError, api, type MyTasksResponse, type TaskGroupItem } from '../lib/api'
import { LoadingScreen } from '../components/LoadingScreen'
import { Logo } from '../components/Navbar'
import { formatRelativeTime } from '../lib/format'

const CONFIDENCE_THRESHOLD = 0.55

export default function MyTasks() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<MyTasksResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hideDone, setHideDone] = useState(false)

  const load = () => {
    if (!token) return
    setError(null)
    api
      .get<MyTasksResponse>(`/tasks/${token}`)
      .then(setData)
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : 'Gagal memuat tugas')
      })
  }

  useEffect(load, [token])

  const toggle = async (item: TaskGroupItem, nextDone: boolean) => {
    if (!data) return
    // Optimistic update
    setData({
      ...data,
      openCount: data.openCount + (nextDone ? -1 : 1),
      groups: data.groups.map((g) => ({
        ...g,
        items: g.items.map((it) => (it.id === item.id ? { ...it, done: nextDone } : it)),
      })),
    })
    try {
      await api.patch(`/tasks/${token}/item/${item.id}`, { done: nextDone })
    } catch {
      // Revert on failure
      load()
    }
  }

  if (error) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 bg-white">
        <div className="text-center max-w-sm">
          <WarningCircle weight="duotone" size={48} className="mx-auto text-red-500" />
          <p className="mt-3 font-medium">{error}</p>
          <Link to="/" className="btn-ghost mt-6 inline-flex">
            <ArrowLeft size={16} />
            Beranda ALTO
          </Link>
        </div>
      </div>
    )
  }

  if (!data) return <LoadingScreen />

  const visibleGroups = data.groups
    .map((g) => ({ ...g, items: hideDone ? g.items.filter((i) => !i.done) : g.items }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="min-h-[100dvh] bg-white">
      <header className="border-b border-zinc-200/70 bg-white/85 backdrop-blur-xl sticky top-0 z-10">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4 md:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo />
            <span className="text-[15px] font-semibold tracking-tight">ALTO</span>
          </Link>
          <span className="text-xs font-medium text-zinc-400">Tugas saya</span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 md:px-8 pt-6 pb-24 md:pb-12">
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 100, damping: 22 }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="eyebrow mb-2">Tugas</p>
              <h1 className="text-2xl md:text-3xl tracking-tightest font-semibold leading-tight">
                {data.user.displayName}
              </h1>
              <p className="mt-2 text-xs text-zinc-500 tabular-nums">
                {data.openCount} tugas terbuka · {data.totalCount} total
              </p>
            </div>
            <div className="grid place-items-center w-12 h-12 rounded-2xl bg-ink text-white flex-shrink-0">
              <ListChecks weight="duotone" size={22} />
            </div>
          </div>

          <label className="mt-5 flex items-center gap-2 text-sm text-zinc-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideDone}
              onChange={(e) => setHideDone(e.target.checked)}
              className="rounded border-zinc-300 text-ink focus:ring-zinc-900/20"
            />
            Sembunyikan tugas yang sudah selesai
          </label>
        </motion.div>

        <div className="mt-8 space-y-6">
          {visibleGroups.length === 0 ? (
            <div className="card p-12 text-center">
              <Check weight="duotone" size={40} className="mx-auto text-emerald-500" />
              <p className="mt-3 text-sm text-zinc-600">
                {data.totalCount === 0
                  ? 'Belum ada tugas untuk kamu.'
                  : 'Semua tugas sudah selesai. Mantap!'}
              </p>
            </div>
          ) : (
            visibleGroups.map((g) => (
              <motion.section
                key={g.jobId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="card p-4 sm:p-5 shadow-sm"
              >
                <div className="flex items-baseline justify-between gap-3 mb-3">
                  <h2 className="font-semibold truncate text-[15px]">
                    {g.title ?? g.filename}
                  </h2>
                  <span className="text-[11px] text-zinc-400 flex-shrink-0 tabular-nums">
                    {formatRelativeTime(g.completedAt ?? g.createdAt)}
                  </span>
                </div>
                <ul className="divide-y divide-zinc-100">
                  {g.items.map((it) => (
                    <li key={it.id} className="flex items-start gap-3 py-2.5">
                      <button
                        onClick={() => toggle(it, !it.done)}
                        className={`mt-0.5 grid place-items-center w-5 h-5 rounded-md border flex-shrink-0 transition ${
                          it.done
                            ? 'bg-ink border-ink text-white'
                            : 'border-zinc-300 text-transparent hover:border-ink'
                        }`}
                        aria-label={it.done ? 'Tandai belum selesai' : 'Tandai selesai'}
                      >
                        <Check size={12} weight="bold" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm leading-relaxed ${
                            it.done ? 'line-through text-zinc-400' : 'text-zinc-800'
                          }`}
                        >
                          {it.task}
                        </p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {it.due && (
                            <span className="text-[11px] text-zinc-500 tabular-nums">
                              Tenggat: {it.due}
                            </span>
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
      </main>
    </div>
  )
}
