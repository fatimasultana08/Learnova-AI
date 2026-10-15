import { useEffect, useState } from 'react'
import { useTheme } from '../context/ThemeContext'
import { Menu, Moon, Sun, Bell, Plus, Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { notificationsApi } from '../api'
import clsx from 'clsx'

interface TopbarProps {
  onMenuClick: () => void
}

export default function Topbar({ onMenuClick }: TopbarProps) {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const load = async () => {
      try {
        const r = await notificationsApi.list(true)
        setUnread(r.data.length)
      } catch { /* silently ignore */ }
    }
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className={clsx(
      'h-14 flex items-center gap-3 px-4 border-b sticky top-0 z-20',
      isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
    )}>
      {/* Mobile menu */}
      <button
        className="lg:hidden p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
        onClick={onMenuClick}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Search */}
      <div className={clsx(
        'flex items-center gap-2 flex-1 max-w-sm px-3 py-1.5 rounded-lg text-sm',
        isDark ? 'bg-slate-800 text-slate-300' : 'bg-slate-100 text-slate-500'
      )}>
        <Search className="w-4 h-4 shrink-0" />
        <input
          type="text"
          placeholder="Search subjects, topics…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-transparent outline-none w-full"
          onKeyDown={e => {
            if (e.key === 'Enter' && search.trim()) {
              navigate(`/subjects?q=${encodeURIComponent(search)}`)
            }
          }}
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        {/* Quick add */}
        <button
          onClick={() => navigate('/subjects')}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New</span>
        </button>

        {/* Notifications */}
        <button
          onClick={() => navigate('/notifications')}
          className={clsx(
            'relative p-2 rounded-lg transition-colors',
            isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
          )}
        >
          <Bell className="w-5 h-5" />
          {unread > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>

        {/* Theme toggle */}
        <button
          onClick={toggle}
          className={clsx(
            'p-2 rounded-lg transition-colors',
            isDark ? 'hover:bg-slate-800' : 'hover:bg-slate-100'
          )}
        >
          {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {/* Avatar */}
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center cursor-pointer"
          onClick={() => navigate('/settings')}>
          <span className="text-white text-xs font-bold">S</span>
        </div>
      </div>
    </header>
  )
}
