import { useEffect, useState } from 'react'
import { tasksApi, subjectsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { Plus, CheckCircle2, Clock, Trash2, Wand2 } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const STATUS_COLORS: Record<string, string> = {
  todo: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
}

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-green-500',
  medium: 'text-yellow-500',
  high: 'text-red-500',
}

export default function Planner() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [tasks, setTasks] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    title: '', subject_id: '', due_date: '', priority: 'medium', task_type: 'general', estimated_minutes: '30',
  })

  const load = async () => {
    setLoading(true)
    try {
      const [tR, sR] = await Promise.all([tasksApi.list(), subjectsApi.list(false)])
      setTasks(tR.data)
      setSubjects(sR.data)
    } catch { toast.error('Failed to load tasks') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const generatePlan = async () => {
    setGenerating(true)
    try {
      const r = await tasksApi.generatePlan(7, 3)
      toast.success(`Generated ${r.data.length} study tasks!`)
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to generate plan')
    } finally {
      setGenerating(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await tasksApi.create({
        ...form,
        subject_id: form.subject_id ? parseInt(form.subject_id) : null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        estimated_minutes: form.estimated_minutes ? parseInt(form.estimated_minutes) : null,
      })
      toast.success('Task created')
      setShowForm(false)
      load()
    } catch { toast.error('Failed to create task') }
  }

  const markComplete = async (id: number) => {
    try {
      await tasksApi.update(id, { status: 'completed' })
      setTasks(prev => prev.map(t => t.id === id ? { ...t, status: 'completed' } : t))
    } catch { toast.error('Failed to update task') }
  }

  const deleteTask = async (id: number) => {
    try {
      await tasksApi.delete(id)
      setTasks(prev => prev.filter(t => t.id !== id))
    } catch { toast.error('Failed to delete task') }
  }

  const pending = tasks.filter(t => t.status !== 'completed')
  const completed = tasks.filter(t => t.status === 'completed')

  const card = clsx('rounded-xl border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Study Planner</h1>
        <div className="flex gap-2">
          <button
            onClick={generatePlan}
            disabled={generating}
            className={clsx('flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors',
              isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-50'
            )}
          >
            {generating ? <div className="animate-spin w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full" /> : <Wand2 className="w-4 h-4 text-purple-500" />}
            Auto-Generate Plan
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
          >
            <Plus className="w-4 h-4" /> Add Task
          </button>
        </div>
      </div>

      {showForm && (
        <div className={clsx(card, 'p-5')}>
          <h2 className="font-semibold mb-4">New Task</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Title *</label>
              <input type="text" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                placeholder="e.g. Review Exception Handling" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Subject</label>
              <select value={form.subject_id} onChange={e => setForm(f => ({ ...f, subject_id: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}>
                <option value="">None</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Estimated minutes</label>
              <input type="number" value={form.estimated_minutes} onChange={e => setForm(f => ({ ...f, estimated_minutes: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                min={5} />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">Create</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : (
        <>
          {/* Pending tasks */}
          <div>
            <h2 className="font-semibold mb-3">Pending ({pending.length})</h2>
            {pending.length === 0 ? (
              <div className={clsx(card, 'p-8 text-center')}>
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-green-400" />
                <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
                  All tasks done! Click "Auto-Generate Plan" to create a new study schedule.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pending.map(t => (
                  <div key={t.id} className={clsx(card, 'flex items-center gap-3 px-4 py-3')}>
                    <button onClick={() => markComplete(t.id)} className="shrink-0">
                      <CheckCircle2 className={clsx('w-5 h-5', PRIORITY_COLORS[t.priority])} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{t.title}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={clsx('text-xs px-1.5 py-0.5 rounded', STATUS_COLORS[t.status])}>
                          {t.status.replace('_', ' ')}
                        </span>
                        {t.due_date && (
                          <span className={clsx('text-xs flex items-center gap-1',
                            t.status === 'overdue' ? 'text-red-500' : isDark ? 'text-slate-400' : 'text-slate-500'
                          )}>
                            <Clock className="w-3 h-3" />
                            {new Date(t.due_date).toLocaleDateString()}
                          </span>
                        )}
                        {t.estimated_minutes && (
                          <span className={clsx('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                            ~{t.estimated_minutes}min
                          </span>
                        )}
                      </div>
                    </div>
                    <button onClick={() => deleteTask(t.id)} className="p-1.5 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Completed tasks */}
          {completed.length > 0 && (
            <div>
              <h2 className="font-semibold mb-3 text-slate-400">Completed ({completed.length})</h2>
              <div className="space-y-2">
                {completed.slice(0, 5).map(t => (
                  <div key={t.id} className={clsx(card, 'flex items-center gap-3 px-4 py-3 opacity-60')}>
                    <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                    <p className="text-sm line-through flex-1">{t.title}</p>
                    <button onClick={() => deleteTask(t.id)} className="p-1.5 text-red-400 rounded shrink-0">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
