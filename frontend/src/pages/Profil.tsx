import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  SignOut,
  ShieldStar,
  Coin,
  Clock,
  Files,
  CurrencyDollar,
  Link as LinkIcon,
  CheckCircle,
  Copy,
  PencilSimple,
} from '@phosphor-icons/react'
import { ApiError, api, type UserStats } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'
import { formatDuration, formatRelativeTime } from '../lib/format'

const USD_TO_IDR = 16_000

export default function Profil() {
  const { user, refresh } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [stats, setStats] = useState<UserStats | null>(null)
  const [taskToken, setTaskToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [editingName, setEditingName] = useState(false)
  const [displayName, setDisplayName] = useState(user?.displayName ?? user?.username ?? '')
  const [savingName, setSavingName] = useState(false)

  useEffect(() => {
    refresh()
    api.get<UserStats>('/auth/me/stats').then(setStats).catch(() => {})
  }, [refresh])

  const handleCreateLink = async () => {
    try {
      const res = await api.post<{ taskShareToken: string }>('/auth/me/task-token')
      setTaskToken(res.taskShareToken)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Gagal membuat tautan', 'error')
    }
  }

  const handleCopyLink = async () => {
    if (!taskToken) return
    await navigator.clipboard.writeText(`${window.location.origin}/tasks/${taskToken}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleSaveName = async () => {
    setSavingName(true)
    try {
      await api.patch('/auth/me/display-name', { displayName })
      await refresh()
      setEditingName(false)
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Gagal menyimpan', 'error')
    } finally {
      setSavingName(false)
    }
  }

  if (!user) return null

  const initials = (user.displayName ?? user.username)
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="mx-auto max-w-3xl px-4 md:px-8 pt-8 md:pt-12 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-32">
      {/* Identity card */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="card-navy p-6 md:p-8 mb-6 relative overflow-hidden"
      >
        <div className="absolute inset-0 grid-pattern opacity-30 pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="grid place-items-center w-16 h-16 rounded-2xl bg-white/15 backdrop-blur text-white font-display font-semibold text-2xl flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nama tampilan"
                  className="bg-white/15 text-white placeholder-white/50 rounded-lg px-3 py-1.5 text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-white/30 max-w-[60%]"
                  maxLength={80}
                  autoFocus
                />
                <button
                  onClick={handleSaveName}
                  disabled={savingName || !displayName.trim()}
                  className="grid place-items-center w-8 h-8 rounded-lg bg-white text-navy disabled:opacity-40"
                >
                  <CheckCircle size={16} weight="fill" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-semibold tracking-tight text-white truncate">
                  {user.displayName ?? user.username}
                </h1>
                <button
                  onClick={() => setEditingName(true)}
                  className="grid place-items-center w-7 h-7 rounded-md text-white/60 hover:text-white hover:bg-white/10"
                  aria-label="Edit nama tampilan"
                >
                  <PencilSimple size={14} />
                </button>
              </div>
            )}
            <p className="text-sm text-white/60 mt-0.5">@{user.username}</p>
            {user.isAdmin && (
              <span className="inline-flex items-center gap-1 mt-2 chip bg-white/15 text-white">
                <ShieldStar size={11} weight="fill" /> Admin
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Stats grid */}
      {stats ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
        >
          <StatTile icon={Coin} label="Sisa kredit" value={formatDuration(stats.creditSeconds)} color="amber" />
          <StatTile icon={Files} label="Total file" value={String(stats.totalJobs)} color="brand" />
          <StatTile icon={Clock} label="Total durasi" value={formatDuration(stats.totalDurationSec)} color="emerald" />
          <StatTile
            icon={CurrencyDollar}
            label="Est. biaya"
            value={`Rp${Math.round(stats.estimatedCostUSD * USD_TO_IDR).toLocaleString('id-ID')}`}
            color="violet"
            small
          />
        </motion.div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="card p-4">
              <div className="skeleton h-9 w-9 rounded-xl mb-3" />
              <div className="skeleton h-6 w-20 rounded mb-1" />
              <div className="skeleton h-3 w-16 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Personal task link */}
      <div className="card p-5 mb-3">
        <div className="flex items-start gap-3">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-brand-soft text-brand-deep flex-shrink-0">
            <LinkIcon size={18} weight="duotone" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-ink text-[15px]">Tautan tugas pribadi</p>
            <p className="text-[13px] text-ink-muted leading-relaxed mt-0.5">
            Bagikan tautan ini agar orang lain bisa lihat semua tugasmu tanpa login.
            </p>
            {taskToken ? (
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 truncate rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-600 font-mono select-all">
                  {window.location.origin}/tasks/{taskToken}
                </code>
                <button
                  onClick={handleCopyLink}
                  className={`btn-soft text-xs !py-2 !px-3 flex-shrink-0 ${copied ? '!bg-emerald-50 !text-emerald-600 !border-emerald-200' : ''}`}
                >
                  {copied ? <CheckCircle size={13} weight="fill" /> : <Copy size={13} />}
                  {copied ? 'Tersalin' : 'Salin'}
                </button>
              </div>
            ) : (
              <button
                onClick={handleCreateLink}
                className="btn-soft mt-3 text-xs !py-2 !px-3"
              >
                <LinkIcon size={13} />
                Buat tautan
              </button>
            )}
          </div>
        </div>
      </div>

      {stats?.memberSince && (
        <p className="text-xs text-slate-400 px-1 mb-4 tabular">
          Bergabung {formatRelativeTime(stats.memberSince)}
        </p>
      )}

      {/* Admin link */}
      {user.isAdmin && (
        <Link to="/admin" className="card p-4 mb-3 flex items-center gap-3 hover:bg-paper transition-colors">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-navy text-white flex-shrink-0">
            <ShieldStar size={18} weight="fill" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-ink">Panel Admin</p>
            <p className="text-xs text-ink-muted">Kelola user, kredit, dan analytics tim.</p>
          </div>
        </Link>
      )}
    </div>
  )
}

function StatTile({
  icon: Icon,
  label,
  value,
  color,
  small,
}: {
  icon: typeof Coin
  label: string
  value: string
  color: 'amber' | 'brand' | 'emerald' | 'violet'
  small?: boolean
}) {
  const colors = {
    amber: 'bg-amber-50 text-amber-600',
    brand: 'bg-brand-soft text-brand-deep',
    emerald: 'bg-emerald-50 text-emerald-600',
    violet: 'bg-violet-50 text-violet-600',
  }
  return (
    <div className="card p-4">
      <div className={`grid place-items-center w-9 h-9 rounded-xl ${colors[color]} mb-3`}>
        <Icon size={16} weight="duotone" />
      </div>
      <p className={`font-semibold text-ink tabular ${small ? 'text-sm' : 'text-lg'} leading-tight`}>
        {value}
      </p>
      <p className="text-[11px] text-ink-muted mt-1 font-medium">{label}</p>
    </div>
  )
}
