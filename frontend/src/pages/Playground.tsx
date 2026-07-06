import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Check,
  Trash,
  PencilSimple,
  Plus,
  X,
  CheckCircle,
  ListChecks,
  Sparkle,
  MagicWand,
  Question,
  Clock,
  At,
  Hash,
  CaretRight,
  Lightbulb,
  ArrowSquareOut,
  CaretDown,
} from '@phosphor-icons/react'
import { ApiError, api } from '../lib/api'
import { useAuth } from '../hooks/useAuth'
import { HighlightedInput } from '../components/HighlightedInput'

interface PlaygroundTask {
  id: string
  owner: string
  task: string
  due: string | null
  confidence: number
  done: boolean
  order: number
  createdAt: string
}

interface PlaygroundUser {
  id: string
  username: string
  displayName: string | null
}

const SYMBOLS = [
  { icon: At, token: '@nama', desc: 'Menugaskan ke orang tertentu', example: 'Bikin laporan keuangan @Salopu' },
  { icon: Clock, token: '!besok', desc: 'Set tenggat waktu', example: 'Revisi draft kontrak !jum\'at' },
  { icon: Hash, token: '#urgent', desc: 'Label prioritas', example: 'Servis AC #urgent #gedung' },
  { icon: CaretRight, token: '>>', desc: 'Sub-task dari tugas sebelumnya', example: '>> Kirim draft ke client untuk review' },
]

const EXAMPLE_PROMPTS = [
  'Minggu ini: @Salopu siapkan laporan keuangan !jum\'at. @Johan revisi draft kontrak !senin #urgent. Rapat koordinasi tim @Salopu @Johan !rabu.',
  'Tugas rumah tangga: @Salopu belanja bahan masakan !besok. @Johan cuci mobil #low. Bersihin gudang >> Buang barang bekas >> Sapu lantai.',
  'Project sprint 3: @Salopu deploy staging !jum\'at #urgent. @Johan review PR #high. Update dokumentasi API. Testing flow payment >> Regression test >> UAT sign-off.',
]

export default function Playground() {
  const { user } = useAuth()
  const [tasks, setTasks] = useState<PlaygroundTask[]>([])
  const [users, setUsers] = useState<PlaygroundUser[]>([])
  const [newOwner, setNewOwner] = useState('')
  const [newTask, setNewTask] = useState('')
  const [newDue, setNewDue] = useState('')
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [editTask, setEditTask] = useState('')
  const [error, setError] = useState<string | null>(null)

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiResult, setAiResult] = useState<Array<{ owner: string; task: string; due: string | null }> | null>(null)
  const [aiError, setAiError] = useState<string | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [showExamples, setShowExamples] = useState(false)

  const loadTasks = async () => {
    try {
      const [t, u] = await Promise.all([
        api.get<{ tasks: PlaygroundTask[] }>('/playground/tasks'),
        api.get<{ users: PlaygroundUser[] }>('/playground/users'),
      ])
      setTasks(t.tasks)
      setUsers(u.users)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data')
    }
  }

  useEffect(() => { void loadTasks() }, [])

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() || aiPrompt.length < 3) return
    setAiLoading(true)
    setAiError(null)
    setAiResult(null)
    try {
      const res = await api.post<{ tasks: Array<{ owner: string; task: string; due: string | null }>; count: number }>(
        '/playground/generate',
        { prompt: aiPrompt.trim() }
      )
      setAiResult(res.tasks)
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : 'Gagal generate tugas')
    } finally {
      setAiLoading(false)
    }
  }

  const handleAcceptAiTasks = async () => {
    if (!aiResult || aiResult.length === 0) return
    setSaving(true)
    try {
      for (const t of aiResult) {
        await api.post('/playground/tasks', {
          owner: t.owner,
          task: t.task,
          due: t.due || null,
        })
      }
      setAiResult(null)
      setAiPrompt('')
      await loadTasks()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan tugas AI')
    } finally {
      setSaving(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newOwner.trim() || !newTask.trim()) return
    setSaving(true)
    setError(null)
    try {
      await api.post('/playground/tasks', {
        owner: newOwner.trim(),
        task: newTask.trim(),
        due: newDue.trim() || null,
      })
      setNewTask('')
      setNewDue('')
      await loadTasks()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal membuat tugas')
    } finally {
      setSaving(false)
    }
  }

  const handleToggle = async (t: PlaygroundTask) => {
    try {
      await api.patch(`/playground/tasks/${t.id}`, { done: !t.done })
      setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengupdate tugas')
    }
  }

  const handleEdit = async (id: string) => {
    if (!editTask.trim()) return
    try {
      await api.patch(`/playground/tasks/${id}`, { task: editTask.trim() })
      setEditId(null)
      await loadTasks()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/playground/tasks/${id}`)
      setTasks((prev) => prev.filter((x) => x.id !== id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus tugas')
    }
  }

  const grouped = tasks.reduce(
    (acc, t) => {
      const g = acc.find((x) => x.owner === t.owner)
      if (g) g.items.push(t)
      else acc.push({ owner: t.owner, items: [t] })
      return acc
    },
    [] as { owner: string; items: PlaygroundTask[] }[]
  )

  if (!user?.isAdmin) return null

  return (
    <div className="mx-auto max-w-6xl px-4 md:px-8 pt-8 md:pt-12 pb-[calc(5.5rem+env(safe-area-inset-bottom))] md:pb-32">
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-6">
          <div className="grid place-items-center w-10 h-10 rounded-xl bg-navy text-white flex-shrink-0">
            <MagicWand size={18} weight="duotone" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-navy">Playground Tugas</h1>
            <p className="text-sm text-ink-muted mt-0.5">Buat tugas pakai AI atau manual.</p>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700">
          <X size={14} weight="fill" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
        </div>
      )}

      {/* AI Section */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="card overflow-hidden mb-6"
      >
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50/50 px-5 py-4 border-b border-slate-200/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="grid place-items-center w-8 h-8 rounded-lg bg-violet-100 text-violet-700">
                <Sparkle size={15} weight="fill" />
              </div>
              <div>
                <p className="font-semibold text-[15px] text-navy">Generate tugas dengan AI</p>
                <p className="text-xs text-ink-muted mt-0.5">Deskripsikan tugas dalam Bahasa Indonesia, AI akan mem-parse-nya</p>
              </div>
            </div>
            <button
              onClick={() => setShowGuide(!showGuide)}
              className="btn-soft text-xs !py-1.5 !px-3 gap-1.5"
            >
              <Question size={12} weight="bold" />
              {showGuide ? 'Tutup panduan' : 'Panduan simbol'}
            </button>
          </div>
        </div>

        <div className="p-5">
          {showGuide && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="mb-5 overflow-hidden"
            >
              <div className="bg-paper rounded-xl p-4 border border-slate-200/80">
                <p className="text-xs font-semibold text-ink-muted uppercase tracking-wide mb-3">Panduan simbol</p>
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  {SYMBOLS.map((s) => (
                    <div key={s.token} className="flex items-start gap-2.5">
                      <div className="grid place-items-center w-7 h-7 rounded-lg bg-violet-100 text-violet-700 flex-shrink-0 mt-0.5">
                        <s.icon size={13} />
                      </div>
                      <div>
                        <code className="text-xs font-mono font-semibold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded">
                          {s.token}
                        </code>
                        <p className="text-xs text-ink-muted mt-0.5">{s.desc}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{s.example}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div>
                  <button
                    onClick={() => setShowExamples(!showExamples)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted hover:text-navy transition-colors"
                  >
                    <Lightbulb size={13} weight="fill" />
                    Contoh prompt
                    <CaretDown size={11} className={`transition-transform ${showExamples ? 'rotate-180' : ''}`} />
                  </button>
                  {showExamples && (
                    <div className="mt-3 space-y-2">
                      {EXAMPLE_PROMPTS.map((ex, i) => (
                        <button
                          key={i}
                          onClick={() => { setAiPrompt(ex); setShowExamples(false) }}
                          className="w-full text-left rounded-lg bg-white border border-slate-200 px-3 py-2.5 text-xs text-ink-muted hover:border-violet-200 hover:bg-violet-50/30 transition-all leading-relaxed"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <HighlightedInput
                value={aiPrompt}
                onChange={setAiPrompt}
                placeholder="Contoh: @Salopu siapkan laporan keuangan !jum'at. @Johan revisi draft kontrak !senin #urgent."
                maxLength={2000}
              />
              {aiPrompt.length > 0 && (
                <p className="text-[11px] text-slate-400 mt-1 text-right">{aiPrompt.length}/2000</p>
              )}
            </div>
            <div className="flex sm:flex-col gap-2 shrink-0">
              <button
                onClick={handleAiGenerate}
                disabled={aiLoading || aiPrompt.trim().length < 3}
                className="btn-primary text-sm gap-1.5 self-start"
              >
                {aiLoading ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Sparkle size={14} weight="fill" />
                )}
                {aiLoading ? 'Memproses…' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* AI Results */}
      <AnimatePresence>
        {aiError && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2.5 text-xs text-red-700"
          >
            <X size={14} weight="fill" />
            {aiError}
            <button onClick={() => setAiError(null)} className="ml-auto"><X size={14} /></button>
          </motion.div>
        )}

        {aiResult && aiResult.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="card p-5 mb-6 border-violet-200/60"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkle size={15} className="text-violet-600" weight="fill" />
                <p className="font-semibold text-[15px] text-navy">Hasil AI ({aiResult.length} tugas)</p>
              </div>
              <button onClick={handleAcceptAiTasks} disabled={saving} className="btn-primary text-xs gap-1.5">
                <CheckCircle size={13} weight="fill" />
                {saving ? 'Menyimpan…' : 'Terima semua'}
              </button>
            </div>
            <div className="divide-y divide-slate-100">
              {aiResult.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-start gap-3 py-2.5"
                >
                  <span className="text-[11px] text-slate-300 font-mono w-5 flex-shrink-0 mt-0.5">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-navy font-medium">{t.task}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[11px] bg-violet-50 text-violet-700 font-medium px-1.5 py-0.5 rounded">
                        @{t.owner}
                      </span>
                      {t.due && (
                        <span className="text-[11px] bg-amber-50 text-amber-700 font-medium px-1.5 py-0.5 rounded">
                          !{t.due}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Manual form */}
      <form onSubmit={handleCreate} className="card p-5 mb-6">
        <p className="font-semibold text-ink text-[15px] mb-3">Tugas manual</p>
        <div className="grid sm:grid-cols-3 gap-3">
          <select
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            className="input"
            required
          >
            <option value="">Pilih pemilik…</option>
            {users.map((u) => (
              <option key={u.id} value={u.displayName ?? u.username}>
                {u.displayName ?? u.username} (@{u.username})
              </option>
            ))}
          </select>
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="Deskripsi tugas"
            className="input sm:col-span-2"
            required
            maxLength={400}
          />
        </div>
        <div className="flex items-center gap-3 mt-3">
          <input
            type="text"
            value={newDue}
            onChange={(e) => setNewDue(e.target.value)}
            placeholder="Tenggat (opsional, contoh: besok)"
            className="input flex-1"
            maxLength={80}
          />
          <button
            type="submit"
            disabled={saving || !newOwner.trim() || !newTask.trim()}
            className="btn-primary text-xs whitespace-nowrap"
          >
            <Plus size={14} weight="bold" />
            Tambah
          </button>
        </div>
      </form>

      {/* Task list */}
      <div className="space-y-4">
        {grouped.length === 0 ? (
          <div className="card p-12 text-center">
            <ListChecks weight="duotone" size={40} className="mx-auto text-slate-300" />
            <p className="mt-3 text-sm text-ink-muted">Belum ada tugas di playground.</p>
          </div>
        ) : (
          grouped.map((g) => (
            <motion.section
              key={g.owner}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-4 sm:p-5"
            >
              <h2 className="font-semibold text-[15px] text-navy mb-3">{g.owner}</h2>
              <ul className="divide-y divide-slate-100">
                {g.items.map((t) => (
                  <li key={t.id} className="flex items-start gap-3 py-2.5 group">
                    <button
                      onClick={() => handleToggle(t)}
                      className={`mt-0.5 grid place-items-center w-5 h-5 rounded-md border flex-shrink-0 transition ${
                        t.done
                          ? 'bg-navy border-navy text-white'
                          : 'border-slate-300 text-transparent hover:border-brand'
                      }`}
                      aria-label={t.done ? 'Tandai belum selesai' : 'Tandai selesai'}
                    >
                      <Check size={12} weight="bold" />
                    </button>
                    <div className="flex-1 min-w-0">
                      {editId === t.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={editTask}
                            onChange={(e) => setEditTask(e.target.value)}
                            className="input flex-1 text-sm !py-1.5"
                            autoFocus
                            maxLength={400}
                          />
                          <button
                            onClick={() => handleEdit(t.id)}
                            className="grid place-items-center w-7 h-7 rounded-md bg-navy text-white flex-shrink-0"
                          >
                            <CheckCircle size={14} weight="fill" />
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="grid place-items-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <p className={`text-sm leading-relaxed ${t.done ? 'line-through text-slate-400' : 'text-navy'}`}>
                          {t.task}
                        </p>
                      )}
                      {t.due && !t.done && (
                        <span className="text-[11px] text-ink-muted mt-1 inline-block">
                          Tenggat: {t.due}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      {editId !== t.id && (
                        <button
                          onClick={() => { setEditId(t.id); setEditTask(t.task) }}
                          className="grid place-items-center w-7 h-7 rounded-md text-slate-400 hover:text-navy hover:bg-slate-100"
                          aria-label="Edit"
                        >
                          <PencilSimple size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(t.id)}
                        className="grid place-items-center w-7 h-7 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Hapus"
                      >
                        <Trash size={13} />
                      </button>
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
