import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { House, ClockCounterClockwise, CheckSquare, UserCircle, MagnifyingGlass } from '@phosphor-icons/react'
import { api } from '../lib/api'

const TABS = [
  { to: '/', icon: House, match: (p: string) => p === '/' },
  { to: '/riwayat', icon: ClockCounterClockwise, match: (p: string) => p.startsWith('/riwayat') || p.startsWith('/job/') },
  { to: '/tugas', icon: CheckSquare, match: (p: string) => p.startsWith('/tugas') },
  { to: '/profil', icon: UserCircle, match: (p: string) => p.startsWith('/profil') || p.startsWith('/admin') },
]

export function BottomDock() {
  const { pathname } = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => {
    const fetchCount = () => {
      api.get<{ count: number }>('/reminders/unread-count')
        .then((r) => setUnreadCount(r.count))
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <nav
      className="fixed bottom-4 md:bottom-6 left-1/2 -translate-x-1/2 z-40"
      aria-label="Navigasi utama"
    >
      <div className="flex items-center gap-2 px-3 py-2 rounded-full bg-surface/95 backdrop-blur-xl border border-slate-200 shadow-dock">
        {TABS.map((tab) => {
          const active = tab.match(pathname)
          const Icon = tab.icon
          const isProfile = tab.to === '/profil'
          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-current={active ? 'page' : undefined}
              className="relative grid place-items-center w-11 h-11 rounded-full transition-colors hover:bg-paper"
            >
              <Icon
                size={22}
                weight={active ? 'fill' : 'regular'}
                className={active ? 'text-brand' : 'text-slate-400'}
              />
              {isProfile && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid place-items-center min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none shadow-sm">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          )
        })}
        <div className="w-px h-6 bg-slate-200" />
        <Link
          to="/search"
          aria-current={pathname.startsWith('/search') ? 'page' : undefined}
          className="grid place-items-center w-11 h-11 rounded-full transition-colors hover:bg-paper"
        >
          <MagnifyingGlass
            size={20}
            weight={pathname.startsWith('/search') ? 'fill' : 'regular'}
            className={pathname.startsWith('/search') ? 'text-brand' : 'text-slate-400'}
          />
        </Link>
      </div>
    </nav>
  )
}
