import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subjectsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { Plus, BookOpen, Trash2, Edit2, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

interface Subject {
  id: number
  name: string
  color: string
  icon: string
  target_grade: string | null
  exam_date: string | null
  archived: boolean
  chapter_count: number
  completed_chapters: number
  total_study_minutes: number
}

const COLORS = [
  '#3b82f6', '#7c5cd8', '#22c55e', '#f59e0b',
  '#ef4444', '#14b8a6', '#f97316', '#ec4899'
]

export default function Subjects() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({ name: '', color: '#3b82f6', target_grade: '', exam_date: '' })

  const load = async () => {
    setLoading(true)
    try {
      const r = await subjectsApi.list(false)
      setSubjects(r.data)
    } catch (e) {
      toast.error('Failed to load subjects')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    try {
      const payload = {
        name: form.name,
        color: form.color,
        target_grade: form.target_grade || null,
        exam_date: form.exam_date ? new Date(form.exam_date).toISOString() : null,
      }
      if (editingId) {
        await subjectsApi.update(editingId, payload)
        toast.success('Subject updated')
      } else {
        await subjectsApi.create(payload)
        toast.success('Subject created')
      }
      setShowForm(false)
      setEditingId(null)
      setForm({ name: '', color: '#3b82f6', target_grade: '', exam_date: '' })
      load()
    } catch (e) {
      toast.error('Failed to save subject')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this subject and all its data?')) return
    try {
      await subjectsApi.delete(id)
      toast.success('Subject deleted')
      load()
    } catch {
      toast.error('Failed to delete')
    }
  }

  const handleEdit = (s: Subject) => {
    setForm({
      name: s.name,
      color: s.color,
      target_grade: s.target_grade || '',
      exam_date: s.exam_date ? s.exam_date.split('T')[0] : '',
    })
    setEditingId(s.id)
    setShowForm(true)
  }

  const card = clsx(
    'rounded-xl border',
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Subjects</h1>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm({ name: '', color: '#3b82f6', target_grade: '', exam_date: '' }) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" /> New Subject
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className={clsx('rounded-xl p-5 border', isDark ? 'bg-slate-800 border-slate-600' : 'bg-blue-50 border-blue-200')}>
          <h2 className="font-semibold mb-4">{editingId ? 'Edit Subject' : 'Create Subject'}</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Subject Name *</label>
              <input
                type="text"
                required
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500',
                  isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
                )}
                placeholder="e.g. Java Programming"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Grade</label>
              <input
                type="text"
                value={form.target_grade}
                onChange={e => setForm(f => ({ ...f, target_grade: e.target.value }))}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500',
                  isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
                )}
                placeholder="e.g. A, 90+"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Exam Date</label>
              <input
                type="date"
                value={form.exam_date}
                onChange={e => setForm(f => ({ ...f, exam_date: e.target.value }))}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500',
                  isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
                )}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Color</label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, color: c }))}
                    className={clsx(
                      'w-7 h-7 rounded-full border-2 transition-all',
                      form.color === c ? 'border-white scale-110 shadow-md' : 'border-transparent'
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className={clsx('px-4 py-2 rounded-lg text-sm border', isDark ? 'border-slate-600' : 'border-slate-300')}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Subject grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : subjects.length === 0 ? (
        <div className={clsx(card, 'p-12 text-center')}>
          <BookOpen className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <h3 className="font-semibold mb-1">No subjects yet</h3>
          <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
            Create your first subject to start organizing your studies
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjects.map(s => {
            const pct = s.chapter_count > 0
              ? Math.round((s.completed_chapters / s.chapter_count) * 100)
              : 0
            return (
              <div key={s.id} className={clsx(card, 'p-5 hover:shadow-md transition-shadow cursor-pointer')}
                onClick={() => navigate(`/subjects/${s.id}`)}>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: s.color + '20' }}
                    >
                      <BookOpen className="w-5 h-5" style={{ color: s.color }} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{s.name}</h3>
                      {s.target_grade && (
                        <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                          Target: {s.target_grade}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={() => handleEdit(s)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span>{s.completed_chapters}/{s.chapter_count} chapters</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, background: s.color }}
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={clsx(isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {Math.round(s.total_study_minutes)}m studied
                  </span>
                  {s.exam_date && (
                    <span className="text-orange-500">
                      Exam: {new Date(s.exam_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="mt-3 flex items-center gap-1 text-blue-500 text-xs font-medium">
                  View Subject <ChevronRight className="w-3.5 h-3.5" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
