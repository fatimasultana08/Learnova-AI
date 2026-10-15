import { useEffect, useState } from 'react'
import { analyticsApi, sessionsApi, mlApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const COLORS = ['#3b82f6', '#7c5cd8', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6']

const PRIORITY_COLORS: Record<string, string> = {
  High: 'bg-red-100 text-red-700',
  Medium: 'bg-yellow-100 text-yellow-700',
  Low: 'bg-green-100 text-green-700',
}

export default function Analytics() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [sessionSummary, setSessionSummary] = useState<any>(null)
  const [dashboard, setDashboard] = useState<any>(null)
  const [mlPredictions, setMlPredictions] = useState<any[]>([])
  const [mlTraining, setMlTraining] = useState(false)
  const [mlEval, setMlEval] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [sessR, dashR, mlR] = await Promise.all([
          sessionsApi.summary(),
          analyticsApi.dashboard(),
          mlApi.predictAll(),
        ])
        setSessionSummary(sessR.data)
        setDashboard(dashR.data)
        setMlPredictions(mlR.data)
      } catch { /* ignore */ } finally { setLoading(false) }
    }
    load()
  }, [])

  const trainModel = async () => {
    setMlTraining(true)
    try {
      const r = await mlApi.train()
      setMlEval(r.data)
      toast.success('ML model trained!')
      const mlR = await mlApi.predictAll()
      setMlPredictions(mlR.data)
    } catch (err: any) {
      toast.error('ML training failed: ' + (err?.response?.data?.detail || err.message))
    } finally {
      setMlTraining(false)
    }
  }

  const card = clsx('rounded-xl border p-5', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  const dailyData = sessionSummary?.daily_breakdown || []
  const subjectData = sessionSummary?.subject_breakdown?.filter((s: any) => s.minutes > 0) || []

  const quizScoreData = dashboard?.recent_quiz_scores?.map((s: any, i: number) => ({
    name: `Attempt ${i + 1}`,
    score: s.score,
  })) || []

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Analytics</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Today', value: `${Math.round(sessionSummary?.today_minutes || 0)}m`, sub: 'study time' },
          { label: 'This Week', value: `${Math.round(sessionSummary?.week_minutes || 0)}m`, sub: 'total' },
          { label: 'Streak', value: `${sessionSummary?.streak_days || 0}d`, sub: 'days' },
          { label: 'Chapters Done', value: `${dashboard?.completed_chapters || 0}/${dashboard?.total_chapters || 0}`, sub: 'completed' },
        ].map(({ label, value, sub }) => (
          <div key={label} className={card}>
            <p className={clsx('text-xs mb-1', isDark ? 'text-slate-400' : 'text-slate-500')}>{label}</p>
            <p className="text-2xl font-bold">{value}</p>
            <p className={clsx('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className={card}>
          <h2 className="font-semibold mb-4">Daily Study Time (7 days)</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dailyData}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => [`${Math.round(v)}m`, 'Minutes']} />
              <Bar dataKey="minutes" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className={card}>
          <h2 className="font-semibold mb-4">Subject Time Distribution</h2>
          {subjectData.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={subjectData} dataKey="minutes" nameKey="subject_name" cx="50%" cy="50%" outerRadius={60}>
                  {subjectData.map((_: any, i: number) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Legend />
                <Tooltip formatter={(v: any) => [`${Math.round(v)}m`, 'Minutes']} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className={clsx('text-center py-12 text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
              No session data yet
            </div>
          )}
        </div>

        {quizScoreData.length > 0 && (
          <div className={card}>
            <h2 className="font-semibold mb-4">Recent Quiz Scores</h2>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={quizScoreData}>
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => [`${v}%`, 'Score']} />
                <Line type="monotone" dataKey="score" stroke="#7c5cd8" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ML Revision Priority */}
      <div className={card}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold">AI Revision Priority</h2>
            <p className={clsx('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
              scikit-learn model classifying chapters by revision urgency
            </p>
          </div>
          <button
            onClick={trainModel}
            disabled={mlTraining}
            className={clsx(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors',
              isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-100 hover:bg-slate-200'
            )}
          >
            {mlTraining ? <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" /> : '🤖'}
            {mlTraining ? 'Training…' : 'Train Model'}
          </button>
        </div>

        {mlEval && (
          <div className={clsx('mb-4 p-3 rounded-lg text-xs', isDark ? 'bg-slate-700' : 'bg-blue-50')}>
            <p className="font-medium mb-1">Training Results</p>
            <p>Data source: <span className="font-medium">{mlEval.data_source}</span></p>
            <p>Training accuracy: <span className="font-medium">{(mlEval.train_accuracy * 100).toFixed(1)}%</span></p>
            {mlEval.test_accuracy && (
              <p>Test accuracy: <span className="font-medium">{(mlEval.test_accuracy * 100).toFixed(1)}%</span></p>
            )}
            <p className="mt-1 text-slate-500">{mlEval.metrics_note}</p>
          </div>
        )}

        {mlPredictions.length === 0 ? (
          <p className={clsx('text-sm text-center py-6', isDark ? 'text-slate-500' : 'text-slate-400')}>
            No chapter data yet. Add chapters and quiz attempts for predictions.
          </p>
        ) : (
          <div className="space-y-2">
            {mlPredictions
              .sort((a, b) => {
                const order = { High: 0, Medium: 1, Low: 2 }
                return (order[a.priority as keyof typeof order] ?? 1) - (order[b.priority as keyof typeof order] ?? 1)
              })
              .map((pred: any) => (
                <div key={pred.chapter_id} className={clsx('flex items-center gap-3 px-3 py-2 rounded-lg', isDark ? 'bg-slate-700' : 'bg-slate-50')}>
                  <span className={clsx('text-xs font-medium px-2 py-1 rounded-full min-w-[60px] text-center', PRIORITY_COLORS[pred.priority])}>
                    {pred.priority}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pred.chapter_title}</p>
                    <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      method: {pred.method} · confidence: {(pred.confidence * 100).toFixed(0)}%
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
