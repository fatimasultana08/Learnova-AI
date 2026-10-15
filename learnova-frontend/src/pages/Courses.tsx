import React, { useEffect, useState } from 'react'
import { coursesApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { Plus, GraduationCap, Trash2, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function Courses() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [courses, setCourses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [form, setForm] = useState({
    title: '', provider: '', description: '', url: '',
    target_end_date: '', learning_goals: '', weekly_target_hours: '2',
  })

  const load = async () => {
    setLoading(true)
    try {
      const r = await coursesApi.list()
      setCourses(r.data)
    } catch { toast.error('Failed to load courses') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await coursesApi.create({
        ...form,
        target_end_date: form.target_end_date ? new Date(form.target_end_date).toISOString() : null,
        weekly_target_hours: parseFloat(form.weekly_target_hours),
      })
      toast.success('Course added')
      setShowForm(false)
      setForm({ title: '', provider: '', description: '', url: '', target_end_date: '', learning_goals: '', weekly_target_hours: '2' })
      load()
    } catch { toast.error('Failed to add course') }
  }

  const deleteCourse = async (id: number) => {
    if (!confirm('Delete this course?')) return
    await coursesApi.delete(id)
    setCourses(prev => prev.filter(c => c.id !== id))
    toast.success('Course deleted')
  }

  const card = clsx('rounded-xl border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Courses</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> Add Course
        </button>
      </div>

      {showForm && (
        <div className={clsx(card, 'p-5')}>
          <h2 className="font-semibold mb-4">Add New Course</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Course Title *</label>
              <input type="text" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                placeholder="e.g. React for Beginners" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Provider</label>
              <input type="text" value={form.provider} onChange={e => setForm(f => ({ ...f, provider: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                placeholder="e.g. Coursera, YouTube" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Course URL</label>
              <input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                placeholder="https://…" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Target Completion</label>
              <input type="date" value={form.target_end_date} onChange={e => setForm(f => ({ ...f, target_end_date: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Learning Goals</label>
              <textarea rows={2} value={form.learning_goals} onChange={e => setForm(f => ({ ...f, learning_goals: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                placeholder="What do you want to learn?" />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Add Course</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : courses.length === 0 ? (
        <div className={clsx(card, 'p-12 text-center')}>
          <GraduationCap className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <h3 className="font-semibold mb-1">No courses yet</h3>
          <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>Add your own courses and track progress</p>
        </div>
      ) : (
        <div className="space-y-4">
          {courses.map(c => (
            <div key={c.id} className={card}>
              <div
                className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpanded(expanded === c.id ? null : c.id)}
              >
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center shrink-0">
                  <GraduationCap className="w-5 h-5 text-purple-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold">{c.title}</h3>
                  <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {c.provider || 'Self-directed'}
                    {c.target_end_date && ` · Due ${new Date(c.target_end_date).toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {c.url && (
                    <a href={c.url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                      className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-blue-500">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                  <button onClick={e => { e.stopPropagation(); deleteCourse(c.id) }} className="p-1.5 rounded text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expanded === c.id ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </div>
              </div>
              {expanded === c.id && (
                <div className={clsx('px-4 pb-4 border-t', isDark ? 'border-slate-700' : 'border-slate-200')}>
                  <div className="pt-3 space-y-2">
                    {c.learning_goals && (
                      <div>
                        <p className="text-xs font-medium text-slate-500">Goals</p>
                        <p className="text-sm">{c.learning_goals}</p>
                      </div>
                    )}
                    {c.modules.length === 0 ? (
                      <p className={clsx('text-sm italic', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        No modules yet. Add modules and lessons to track your progress.
                      </p>
                    ) : (
                      c.modules.map((mod: any) => (
                        <div key={mod.id} className={clsx('rounded-lg p-3', isDark ? 'bg-slate-700' : 'bg-slate-50')}>
                          <p className="font-medium text-sm">{mod.title}</p>
                          <div className="mt-2 space-y-1">
                            {mod.lessons.map((lesson: any) => (
                              <div key={lesson.id} className="flex items-center gap-2 text-xs">
                                <span className={clsx('w-2 h-2 rounded-full shrink-0',
                                  lesson.status === 'completed' ? 'bg-green-500' :
                                  lesson.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'
                                )} />
                                <span className={lesson.status === 'completed' ? 'line-through text-slate-400' : ''}>
                                  {lesson.title}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
