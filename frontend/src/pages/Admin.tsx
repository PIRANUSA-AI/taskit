import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Plus,
  Trash,
  Key,
  ShieldStar,
  User as UserIcon,
  CheckCircle,
  Coin,
  Clipboard,
  Link as LinkIcon,
  ChartLineUp,
  Files,
  Clock,
  CheckSquare,
  Users as UsersIcon,
  WarningCircle,
  ListChecks,
} from '@phosphor-icons/react'
import { ApiError, api, type ManagedUser } from '../lib/api'
import { formatRelativeTime, formatDuration } from '../lib/format'
import { useAuth } from '../hooks/useAuth'
import { TopupModal } from '../components/TopupModal'
import { LineChart, BarChart, DonutProgress } from '../components/charts'
import { useToast } from '../components/Toast'

interface Overview {
  users: number
  admins: number
  jobs: number
  completedJobs: number
  failedJobs: number
  completionRate: number
  totalDurationSec: number
  actionItems: number
  actionItemsDone: number
  actionItemsCompletionRate: number
}
interface TrendPoint { date: string; count: number; duration: number }
interface TopUser {
  id?: string
  username: string
  displayName: string | null
  jobsCompleted: number
  totalDuration: number
}
interface Failure {
  id: string
  filename: string
  error_message: string | null
  created_at: string
  username: string
}

export default function Admin() {
  const { user: self } = useAuth()
  const { toast } = useToast()
  const [users, setUsers] = useState<ManagedUser[] | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [trend, setTrend] = useState<TrendPoint[] | null>(null)
  const [topUsers, setTopUsers] = useState<TopUser[] | null>(null)
  const [failures, setFailures] = useState<Failure[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const [newUsername, setNewUsername] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newDisplayName, setNewDisplayName] = useState('')
  const [makeAdmin, setMakeAdmin] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [flash, setFlash] = useState<string | null>(null)
  const [topupTarget, setTopupTarget] = useState<ManagedUser | null>(null)

  const loadAll = async () => {
    try {
      const [u, o, t, top, f] = await Promise.all([
        api.get<{ users: ManagedUser[] }>('/users'),
        api.get<Overview>('/users/stats/overview'),
        api.get<{ points: TrendPoint[] }>('/users/stats/jobs-trend?days=30'),
        api.get<{ users: TopUser[] }>('/users/stats/top-users?limit=6'),
        api.get<{ failures: Failure[] }>('/users/stats/recent-failures?limit=5'),
      ])
      setUsers(u.users)
      setOverview(o)
      setTrend(t.points)
      setTopUsers(top.users)
      setFailures(f.failures)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data admin')
    }
  }

  useEffect(() => {
    void loadAll()
  }, [])

  const flashSuccess = (msg: string) => {
    setFlash(msg)
    setTimeout(() => setFlash(null), 2500)
  }

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    setCreating(true)
    setCreateError(null)
    try {
      await api.post('/users', {
        username: newUsername.trim(),
        password: newPassword,
        isAdmin: makeAdmin,
        displayName: newDisplayName.trim() || undefined,
      })
      setNewUsername('')
      setNewPassword('')
      setNewDisplayName('')
      setMakeAdmin(false)
      await loadAll()
      flashSuccess(`User "${newUsername}" dibuat`)
    } catch (err) {
      if (err instanceof ApiError) setCreateError(err.message)
      else setCreateError('Gagal membuat user')
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (u: ManagedUser) => {
    if (u.id === self?.id) {
      toast('Tidak bisa hapus akun sendiri', 'error')
      return
    }
    if (!confirm(`Hapus user "${u.username}"? Semua transkripnya juga akan terhapus.`)) return
    try {
      await api.delete(`/users/${u.id}`)
      await loadAll()
      flashSuccess(`User "${u.username}" dihapus`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal menghapus', 'error')
    }
  }

  const handleResetPassword = async (u: ManagedUser) => {
    const np = prompt(`Password baru untuk "${u.username}":`)
    if (!np || np.length < 8) {
      if (np !== null) toast('Password minimal 8 karakter', 'error')
      return
    }
    try {
      await api.patch(`/users/${u.id}/password`, { newPassword: np })
      flashSuccess(`Password "${u.username}" direset`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal reset password', 'error')
    }
  }

  const handleTopupCredits = (u: ManagedUser) => setTopupTarget(u)

  const handleCopyTaskLink = async (u: ManagedUser) => {
    try {
      if (!u.taskShareToken) {
        const res = await api.post<{ taskPath: string }>(`/users/${u.id}/task-token`)
        await loadAll()
        await navigator.clipboard.writeText(`${window.location.origin}${res.taskPath}`)
      } else {
        await navigator.clipboard.writeText(`${window.location.origin}/tasks/${u.taskShareToken}`)
      }
      flashSuccess(`Link tugas "${u.username}" disalin`)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membuat link tugas', 'error')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 pt-8 md:pt-12 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-32">
      <header className="mb-8">
        <p className="eyebrow mb-2">Admin</p>
        <h1 className="text-3xl md:text-4xl tracking-tightest font-semibold text-navy">
          Dashboard Tim
        </h1>
        <p className="mt-2 text-sm text-ink-muted max-w-md leading-relaxed">
          Kelola user, monitor penggunaan, dan pastikan tim tertuntaskan.
        </p>
        <Link
          to="/admin/playground"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand-deep hover:text-brand bg-brand-soft px-3 py-2 rounded-lg transition-colors"
        >
          <ListChecks size={14} weight="bold" />
          Playground Tugas
        </Link>
      </header>

      {flash && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-center gap-2 rounded-xl bg-navy text-white px-4 py-2.5 text-sm"
        >
          <CheckCircle weight="fill" size={16} />
          {flash}
        </motion.div>
      )}

      {error && <p className="text-sm text-red-600 mb-6">{error}</p>}

      {/* Analytics overview (desktop-dense, mobile-stacked) */}
      {overview && (
        <section className="mb-8" aria-label="Analytics">
          <div className="flex items-center gap-2 mb-4">
            <ChartLineUp size={14} weight="bold" className="text-brand-deep" />
            <h2 className="text-sm font-semibold text-navy">Ringkasan tim</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <StatCard icon={UsersIcon} label="Anggota" value={String(overview.users)} sub={`${overview.admins} admin`} color="navy" />
            <StatCard icon={Files} label="Total transkrip" value={String(overview.jobs)} sub={`${overview.completedJobs} selesai`} color="brand" />
            <StatCard icon={Clock} label="Total durasi" value={formatDuration(overview.totalDurationSec)} color="emerald" />
            <StatCard icon={CheckSquare} label="Action items" value={String(overview.actionItems)} sub={`${overview.actionItemsDone} selesai`} color="violet" />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            {/* Jobs trend line */}
            <div className="card p-5 md:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-1">
                Transkrip 30 hari terakhir
              </p>
              <p className="text-2xl font-semibold text-navy tabular mb-3">
                {trend ? trend.reduce((a, b) => a + b.count, 0) : '—'}
                <span className="text-sm text-ink-muted font-normal ml-2">rapat</span>
              </p>
              {trend && <LineChart points={trend} label="Tren transkrip" />}
            </div>

            {/* Completion donut */}
            <div className="card p-5 flex flex-col items-center justify-center">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-3 self-start">
                Action items selesai
              </p>
              <DonutProgress
                value={overview.actionItemsCompletionRate}
                label="selesai"
                color="#6366F1"
              />
              <p className="text-[11px] text-ink-muted mt-3 tabular text-center">
                {overview.actionItemsDone} dari {overview.actionItems} tugas
              </p>
            </div>
          </div>

          {/* Top users + recent failures */}
          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-4">
                Pengguna paling aktif
              </p>
              {topUsers && (
                <BarChart
                  items={topUsers.map((u) => ({
                    label: u.displayName ?? u.username,
                    value: u.jobsCompleted,
                    sub: `· ${formatDuration(u.totalDuration)}`,
                  }))}
                  label="Top user"
                />
              )}
            </div>

            <div className="card p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted mb-4">
                Kegagalan terbaru
              </p>
              {failures && failures.length === 0 ? (
                <p className="text-xs text-ink-muted">Tidak ada job gagal. 🎉</p>
              ) : (
                <ul className="space-y-2.5">
                  {failures?.slice(0, 5).map((f) => (
                    <li key={f.id} className="flex items-start gap-2.5">
                      <span className="grid place-items-center w-7 h-7 rounded-lg bg-red-50 text-red-600 flex-shrink-0 mt-0.5">
                        <WarningCircle size={13} weight="fill" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-ink truncate">{f.filename}</p>
                        <p className="text-[11px] text-ink-muted truncate">
                          @{f.username} · {formatRelativeTime(f.created_at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Create user */}
      <section className="card p-5 sm:p-7 mb-8">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2 text-navy">
          <Plus weight="bold" size={16} /> Tambah anggota
        </h2>
        <form onSubmit={handleCreate} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="label">Username</label>
            <input
              type="text"
              required
              autoCapitalize="none"
              spellCheck={false}
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              className="input"
              placeholder="contoh: rangga"
            />
          </div>
          <div>
            <label className="label">Nama tampilan</label>
            <input
              type="text"
              value={newDisplayName}
              onChange={(e) => setNewDisplayName(e.target.value)}
              className="input"
              placeholder="contoh: Rangga D."
            />
          </div>
          <div>
            <label className="label">Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="input"
              placeholder="min. 8 karakter"
            />
          </div>
          <div className="self-end">
            <button
              type="submit"
              disabled={creating || !newUsername || !newPassword}
              className="btn-primary w-full"
            >
              {creating ? 'Membuat…' : 'Tambah'}
            </button>
          </div>
          <label className="sm:col-span-2 lg:col-span-4 flex items-center gap-2 text-sm text-ink-muted cursor-pointer select-none">
            <input
              type="checkbox"
              checked={makeAdmin}
              onChange={(e) => setMakeAdmin(e.target.checked)}
              className="rounded border-slate-300 text-brand focus:ring-brand/20"
            />
            Jadikan admin (bisa kelola user lain)
          </label>
          {createError && <p className="sm:col-span-2 lg:col-span-4 text-sm text-red-600">{createError}</p>}
        </form>
      </section>

      {/* User list */}
      <section>
        <h2 className="text-sm font-semibold mb-3 px-1 text-navy">Semua anggota</h2>
        {users === null ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="skeleton h-16 rounded-2xl" />
            ))}
          </div>
        ) : users.length === 0 ? (
          <p className="text-sm text-ink-muted px-1">Belum ada user.</p>
        ) : (
          <ul className="divide-y divide-slate-200/80 border-t border-b border-slate-200/80 bg-surface rounded-xl">
            {users.map((u) => (
              <li key={u.id} className="flex items-center gap-4 py-4 px-3 hover:bg-paper rounded-lg">
                <div
                  className={`grid place-items-center w-10 h-10 rounded-xl flex-shrink-0 ${
                    u.isAdmin ? 'bg-navy text-white' : 'bg-brand-soft border border-brand/20 text-brand-deep'
                  }`}
                >
                  {u.isAdmin ? <ShieldStar weight="fill" size={18} /> : <UserIcon size={18} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-ink">
                    {u.displayName ?? u.username}
                    {u.id === self?.id && (
                      <span className="ml-2 text-[11px] text-slate-400 font-normal">(kamu)</span>
                    )}
                  </p>
                  <p className="text-[11px] text-ink-muted truncate">
                    @{u.username} · {u.isAdmin ? 'admin · ' : ''}dibuat {formatRelativeTime(u.createdAt)}
                  </p>
                  <p
                    className={`text-xs mt-0.5 font-medium tabular ${
                      u.creditSeconds < 300 ? 'text-red-500' : 'text-emerald-600'
                    }`}
                  >
                    <Coin size={11} className="inline mr-0.5 mb-0.5" weight="duotone" />
                    {formatDuration(u.creditSeconds)} kredit
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopyTaskLink(u)}
                    className="grid place-items-center w-9 h-9 rounded-lg hover:bg-brand-soft hover:text-brand-deep text-slate-500"
                    title="Salin link tugas"
                  >
                    {u.taskShareToken ? <LinkIcon size={16} /> : <Clipboard size={16} />}
                  </button>
                  <button
                    onClick={() => handleTopupCredits(u)}
                    className="grid place-items-center w-9 h-9 rounded-lg hover:bg-amber-50 hover:text-amber-600 text-slate-500"
                    title="Topup kredit"
                  >
                    <Coin size={16} />
                  </button>
                  <button
                    onClick={() => handleResetPassword(u)}
                    className="grid place-items-center w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500"
                    title="Reset password"
                  >
                    <Key size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(u)}
                    disabled={u.id === self?.id}
                    className="grid place-items-center w-9 h-9 rounded-lg hover:bg-red-50 hover:text-red-600 text-slate-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Hapus user"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <TopupModal
        user={topupTarget}
        onClose={() => setTopupTarget(null)}
        onSuccess={() => {
          void loadAll()
          flashSuccess(`Kredit ditambahkan untuk "${topupTarget?.username}"`)
          setTopupTarget(null)
        }}
      />
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof Coin
  label: string
  value: string
  sub?: string
  color: 'navy' | 'brand' | 'emerald' | 'violet'
}) {
  const colors = {
    navy: 'bg-navy text-white',
    brand: 'bg-brand-soft text-brand-deep',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-4"
    >
      <div className={`grid place-items-center w-9 h-9 rounded-xl ${colors[color]} mb-3`}>
        <Icon size={16} weight="duotone" />
      </div>
      <p className="text-xl font-semibold text-navy tabular leading-tight">{value}</p>
      <p className="text-[11px] text-ink-muted mt-1 font-medium">
        {label}
        {sub && <span className="block text-[10px] opacity-70">{sub}</span>}
      </p>
    </motion.div>
  )
}
