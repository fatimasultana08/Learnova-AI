import { useEffect, useState } from 'react'
import { notificationsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { Bell, CheckCheck, Trash2, RefreshCw, AlertTriangle, Info, CheckCircle, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { useNavigate } from 'react-router-dom'

const CATEGORY_ICONS: Record<string, any> = {
  info: Info,
  warning: AlertTriangle,
  danger: XCircle,
  success: CheckCircle,
}

const CATEGORY_STYLES: Record<string, string> = {
  info: 'bg-blue-100 text-blue-600',
  warning: 'bg-yellow-100 text-yellow-600',
  danger: 'bg-red-100 text-red-600',
  success: 'bg-green-100 text-green-600',
}

export default function NotificationsPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      await notificationsApi.refreshWarnings()
      const r = await notificationsApi.list()
      setNotifications(r.data)
    } catch { /* ignore */ } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const markRead = async (id: number) => {
    await notificationsApi.markRead(id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
  }

  const markAllRead = async () => {
    await notificationsApi.markAllRead()
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const remove = async (id: number) => {
    await notificationsApi.delete(id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  const unread = notifications.filter(n => !n.read).length
  const card = clsx('rounded-xl border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6" /> Notifications
          </h1>
          {unread > 0 && (
            <p className={clsx('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
              {unread} unread
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className={clsx('p-2 rounded-lg', isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100')}>
            <RefreshCw className="w-4 h-4" />
          </button>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-blue-600 text-white"
            >
              <CheckCheck className="w-4 h-4" /> Mark all read
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : notifications.length === 0 ? (
        <div className={clsx(card, 'p-12 text-center')}>
          <Bell className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <h3 className="font-semibold mb-1">All clear!</h3>
          <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
            No notifications. Warnings will appear here as your study data grows.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            const Icon = CATEGORY_ICONS[n.category] || Info
            return (
              <div
                key={n.id}
                className={clsx(
                  card,
                  'flex items-start gap-3 px-4 py-3',
                  !n.read ? (isDark ? 'border-blue-800' : 'border-blue-200 bg-blue-50') : ''
                )}
              >
                <div className={clsx('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', CATEGORY_STYLES[n.category])}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  {n.body && <p className={clsx('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>{n.body}</p>}
                  <p className={clsx('text-xs mt-1', isDark ? 'text-slate-500' : 'text-slate-400')}>
                    {new Date(n.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  {!n.read && (
                    <button onClick={() => markRead(n.id)} className="p-1.5 rounded hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-500" title="Mark read">
                      <CheckCheck className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {n.link && (
                    <button onClick={() => navigate(n.link)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-500 text-xs">
                      →
                    </button>
                  )}
                  <button onClick={() => remove(n.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-400">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
