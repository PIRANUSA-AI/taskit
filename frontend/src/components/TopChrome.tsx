import { Link, useNavigate } from 'react-router-dom'
import { SignOut } from '@phosphor-icons/react'
import { useAuth } from '../hooks/useAuth'
import { BrandMark } from './Brand'

export function TopChrome() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  if (!user) return null

  const handleLogout = async () => {
    await logout()
    navigate('/welcome', { replace: true })
  }

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-paper/85 backdrop-blur-xl">
      <div className="mx-auto flex h-12 max-w-6xl items-center justify-between px-4 md:px-8">
        <Link
          to="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
          aria-label="PIRANUSA — beranda"
        >
          <BrandMark size={26} />
          <span className="text-sm font-semibold tracking-tight text-navy hidden xs:inline">
            PIRANUSA
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-400 truncate max-w-[30vw] md:max-w-[40vw]">
            {user.displayName ?? user.username}
          </span>
          <button
            onClick={handleLogout}
            className="grid place-items-center w-8 h-8 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
            aria-label="Keluar"
            title="Keluar"
          >
            <SignOut size={16} weight="bold" />
          </button>
        </div>
      </div>
    </header>
  )
}
