import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Eye, EyeSlash, ArrowRight, ArrowLeft } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { ApiError } from '../lib/api'
import { BrandMark } from '../components/Brand'

export default function Login() {
  const { user, login, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const from = (location.state as { from?: { pathname: string } } | null)?.from?.pathname ?? '/'

  useEffect(() => {
    if (!loading && user) navigate(from, { replace: true })
  }, [user, loading, navigate, from])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError) setError(err.message)
      else setError('Gagal masuk. Coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-[100dvh] flex items-center justify-center px-6 py-12 bg-paper aurora relative overflow-hidden">
      <div className="absolute inset-0 grid-pattern opacity-50 pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className="relative w-full max-w-sm"
      >
        <div className="flex flex-col items-center mb-9">
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 16, delay: 0.1 }}
          >
            <BrandMark size={56} />
          </motion.div>
          <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-deep">
            TASKIT Tim Internal
          </p>
          <h1 className="mt-2 text-center text-3xl md:text-4xl tracking-tightest leading-[1.05] font-semibold text-navy">
            Masuk
          </h1>
          <p className="mt-2.5 text-center text-[13px] text-ink-muted leading-relaxed">
            Sumber kebenaran rapat tim.
            <br />
            Hubungi admin kalau butuh akun.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="label">
              Username
            </label>
            <input
              id="username"
              type="text"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="input"
              placeholder="contoh: dinda"
            />
          </div>

          <div>
            <label htmlFor="password" className="label">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input pr-12"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 grid place-items-center w-9 h-9 rounded-lg text-slate-400 hover:bg-paper hover:text-navy transition-colors"
                aria-label={showPassword ? 'Sembunyikan password' : 'Lihat password'}
              >
                {showPassword ? <EyeSlash size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="btn-primary w-full mt-2"
          >
            {submitting ? (
              'Memverifikasi…'
            ) : (
              <>
                Masuk
                <ArrowRight weight="bold" size={16} />
              </>
            )}
          </button>
        </form>

        <Link
          to="/welcome"
          className="mt-5 mx-auto flex items-center justify-center gap-1.5 text-xs font-medium text-slate-400 hover:text-navy transition-colors w-fit"
        >
          <ArrowLeft size={12} weight="bold" />
          Lihat perkenalan TASKIT
        </Link>
      </motion.div>
    </div>
  )
}
