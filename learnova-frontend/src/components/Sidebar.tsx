
import { NavLink } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import {
  LayoutDashboard, BookOpen, Bot, FileText, HelpCircle,
  GraduationCap, Calendar, ClipboardList, Timer, BarChart2,
  Bell, Settings, ChevronLeft, ChevronRight, X
} from 'lucide-react'
import clsx from 'clsx'

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/subjects', icon: BookOpen, label: 'My Subjects' },
  { path: '/ai', icon: Bot, label: 'AI Assistant' },
  { path: '/notes', icon: FileText, label: 'Notes' },
  { path: '/quizzes', icon: HelpCircle, label: 'Quizzes' },
  { path: '/courses', icon: GraduationCap, label: 'Courses' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/planner', icon: ClipboardList, label: 'Study Planner' },
  { path: '/timer', icon: Timer, label: 'Focus Timer' },
  { path: '/analytics', icon: BarChart2, label: 'Analytics' },
  { path: '/notifications', icon: Bell, label: 'Notifications' },
  { path: '/settings', icon: Settings, label: 'Settings' },
]

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen: boolean
  onMobileClose: () => void
}

export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }: SidebarProps) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const base = clsx(
    'flex flex-col h-full transition-all duration-200',
    isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200',
    'border-r'
  )

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={clsx(
          base,
          'fixed lg:static z-40 top-0 left-0 h-screen',
          'lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
          'lg:transition-none',
          collapsed ? 'w-16' : 'w-60'
        )}
      >
        {/* Logo */}
        <div className={clsx(
          'flex items-center gap-3 px-4 py-4 border-b',
          isDark ? 'border-slate-700' : 'border-slate-200'
        )}>
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">L</span>
          </div>
          {!collapsed && (
            <span className={clsx('font-bold text-lg', isDark ? 'text-white' : 'text-slate-900')}>
              Learnova
            </span>
          )}
          {/* Mobile close */}
          <button
            className="ml-auto lg:hidden"
            onClick={onMobileClose}
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map(({ path, icon: Icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              className={({ isActive }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 transition-colors',
                collapsed ? 'justify-center' : '',
                isActive
                  ? 'bg-blue-600 text-white'
                  : isDark
                    ? 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              )}
              title={collapsed ? label : undefined}
              onClick={() => onMobileClose()}
            >
              <Icon className="w-5 h-5 shrink-0" />
              {!collapsed && <span className="text-sm font-medium">{label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle (desktop only) */}
        <div className={clsx(
          'hidden lg:flex border-t p-2 justify-end',
          isDark ? 'border-slate-700' : 'border-slate-200'
        )}>
          <button
            onClick={onToggle}
            className={clsx(
              'p-2 rounded-lg transition-colors',
              isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'
            )}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>
      </aside>
    </>
  )
}
