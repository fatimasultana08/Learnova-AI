import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyticsApi, sessionsApi, tasksApi, notificationsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import {
  BookOpen, Clock, TrendingUp, Calendar, CheckCircle2,
  AlertTriangle, Flame, Target, ChevronRight, Plus
} from 'lucide-react'
import clsx from 'clsx'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts'

interface DashboardStats {
  total_study_minutes_today: number
  total_study_minutes_week: number
  total_subjects: number
  total_chapters: number
  completed_chapters: number
  upcoming_exams: any[]
  recent_quiz_scores: any[]
  study_streak_days: number
  pending_tasks: number
  overdue_tasks: number
}

const COLORS = ['#3b82f6', '#7c5cd8', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6']

export default function Dashboard() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [sessionSummary, setSessionSummary] = useState<any>(null)
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [statsR, sessR, tasksR] = await Promise.all([
          analyticsApi.dashboard(),
          sessionsApi.summary(),
          tasksApi.list({ status: 'todo' }),
        ])
        setStats(statsR.data)
        setSessionSummary(sessR.data)
        setTasks(tasksR.data.slice(0, 5))
        // Refresh warnings
        await notificationsApi.refreshWarnings()
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const card = clsx(
    'rounded-xl p-4 border',
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const completionPct = stats && stats.total_chapters > 0
    ? Math.round((stats.completed_chapters / stats.total_chapters) * 100)
    : 0

  const subjectData = sessionSummary?.subject_breakdown || []
  const dailyData = sessionSummary?.daily_breakdown || []

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className={clsx('text-sm mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <button
          onClick={() => navigate('/subjects')}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Subject
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={<Clock className="w-5 h-5 text-blue-500" />}
          label="Today's Study"
          value={`${Math.round(stats?.total_study_minutes_today || 0)}m`}
          sub="minutes"
          dark={isDark}
        />
        <StatCard
          icon={<Flame className="w-5 h-5 text-orange-500" />}
          label="Study Streak"
          value={`${sessionSummary?.streak_days ?? 0}`}
          sub="days"
          dark={isDark}
        />
        <StatCard
          icon={<Target className="w-5 h-5 text-purple-500" />}
          label="Chapters Done"
          value={`${completionPct}%`}
          sub={`${stats?.completed_chapters}/${stats?.total_chapters}`}
          dark={isDark}
        />
        <StatCard
          icon={<AlertTriangle className="w-5 h-5 text-red-500" />}
          label="Overdue Tasks"
          value={`${stats?.overdue_tasks ?? 0}`}
          sub="tasks"
          dark={isDark}
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Daily study chart */}
        <div className={card}>
          <h2 className="font-semibold mb-4">This Week's Study Time</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v: any) => [`${v}m`, 'Minutes']} />
              <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Subject time distribution */}
        <div className={card}>
          <h2 className="font-semibold mb-4">Subject Distribution (This Week)</h2>
          {subjectData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie
                  data={subjectData}
                  dataKey="minutes"
                  nameKey="subject_name"
                  cx="50%"
                  cy="50%"
                  outerRadius={60}
                >
                  {subjectData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: any) => [`${v}m`, 'Minutes']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className={clsx('text-center py-12 text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Start a focus session to see distribution
            </div>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming exams */}
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Upcoming Exams</h2>
            <button
              onClick={() => navigate('/calendar')}
              className="text-blue-500 text-sm flex items-center gap-1"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {stats?.upcoming_exams.length === 0 ? (
            <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
              No upcoming exams. Add exam dates in the Calendar.
            </p>
          ) : (
            <div className="space-y-2">
              {stats?.upcoming_exams.map((e: any) => (
                <div key={e.id} className={clsx(
                  'flex items-center justify-between px-3 py-2 rounded-lg',
                  isDark ? 'bg-slate-700' : 'bg-slate-50'
                )}>
                  <div>
                    <p className="text-sm font-medium">{e.title}</p>
                    <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      {new Date(e.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={clsx(
                    'text-xs font-medium px-2 py-1 rounded-full',
                    e.days_left <= 3 ? 'bg-red-100 text-red-700' :
                    e.days_left <= 7 ? 'bg-orange-100 text-orange-700' :
                    'bg-blue-100 text-blue-700'
                  )}>
                    {e.days_left}d left
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending tasks */}
        <div className={card}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Today's Tasks</h2>
            <button
              onClick={() => navigate('/planner')}
              className="text-blue-500 text-sm flex items-center gap-1"
            >
              View all <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          {tasks.length === 0 ? (
            <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
              No pending tasks. Generate a study plan in the Planner.
            </p>
          ) : (
            <div className="space-y-2">
              {tasks.map((t: any) => (
                <div key={t.id} className={clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-lg',
                  isDark ? 'bg-slate-700' : 'bg-slate-50'
                )}>
                  <CheckCircle2 className={clsx(
                    'w-4 h-4 shrink-0',
                    t.priority === 'high' ? 'text-red-500' :
                    t.priority === 'medium' ? 'text-yellow-500' : 'text-green-500'
                  )} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.title}</p>
                    {t.due_date && (
                      <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        Due {new Date(t.due_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Quick actions */}
      <div className={card}>
        <h2 className="font-semibold mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Add Subject', icon: BookOpen, path: '/subjects' },
            { label: 'Upload PDF', icon: TrendingUp, path: '/subjects' },
            { label: 'Start Timer', icon: Clock, path: '/timer' },
            { label: 'Schedule Exam', icon: Calendar, path: '/calendar' },
          ].map(({ label, icon: Icon, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={clsx(
                'flex flex-col items-center gap-2 p-4 rounded-xl border transition-colors',
                isDark
                  ? 'border-slate-700 hover:bg-slate-700'
                  : 'border-slate-200 hover:bg-slate-50'
              )}
            >
              <Icon className="w-6 h-6 text-blue-500" />
              <span className="text-xs font-medium">{label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ icon, label, value, sub, dark }: any) {
  return (
    <div className={clsx(
      'rounded-xl p-4 border',
      dark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
    )}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className={clsx('text-xs', dark ? 'text-slate-400' : 'text-slate-500')}>{label}</span></div>
      <div className="text-2xl font-bold">{value}</div>
      <div className={clsx('text-xs', dark ? 'text-slate-500' : 'text-slate-400')}>{sub}</div>
    </div>
  )
}
