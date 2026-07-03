import { Link, useLocation } from 'react-router-dom'
import { House, ClockCounterClockwise, CheckSquare, UserCircle } from '@phosphor-icons/react'

const TABS = [
  { to: '/', icon: House, match: (p: string) => p === '/' },
  { to: '/riwayat', icon: ClockCounterClockwise, match: (p: string) => p.startsWith('/riwayat') || p.startsWith('/job/') },
  { to: '/tugas', icon: CheckSquare, match: (p: string) => p.startsWith('/tugas') },
  { to: '/profil', icon: UserCircle, match: (p: string) => p.startsWith('/profil') || p.startsWith('/admin') },
]

export function BottomDock() {
  const { pathname } = useLocation()

  return (
    <nav
      className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-40"
      aria-label="Navigasi utama"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface/95 backdrop-blur-xl border border-slate-200 shadow-dock">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          const Icon = tab.icon
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className="grid place-items-center w-11 h-11 rounded-full transition-colors hover:bg-paper"
            >
              <Icon
                size={22}
                weight={active ? 'fill' : 'regular'}
                className={active ? 'text-brand' : 'text-slate-400'}
              />
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
