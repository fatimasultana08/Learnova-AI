import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { quizzesApi, subjectsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { Plus, HelpCircle, Trash2, Play, Clock } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function Quizzes() {
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [quizzes, setQuizzes] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [form, setForm] = useState({
    subject_id: '',
    title: '',
    difficulty: 'medium',
    num_questions: 5,
    question_types: ['mcq'],
    timed: false,
    time_limit_minutes: 10,
    include_explanations: true,
  })

  const load = async () => {
    setLoading(true)
    try {
      const [qR, sR] = await Promise.all([quizzesApi.list(), subjectsApi.list(false)])
      setQuizzes(qR.data)
      setSubjects(sR.data)
    } catch { toast.error('Failed to load') } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.subject_id) { toast.error('Select a subject'); return }
    setGenerating(true)
    try {
      const r = await quizzesApi.create({
        ...form,
        subject_id: parseInt(form.subject_id),
        time_limit_minutes: form.timed ? form.time_limit_minutes : null,
      })
      toast.success(`Quiz created with ${r.data.total_questions} questions!`)
      setShowForm(false)
      setForm({ subject_id: '', title: '', difficulty: 'medium', num_questions: 5, question_types: ['mcq'], timed: false, time_limit_minutes: 10, include_explanations: true })
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Quiz generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this quiz?')) return
    await quizzesApi.delete(id)
    setQuizzes(prev => prev.filter(q => q.id !== id))
    toast.success('Quiz deleted')
  }

  const toggleType = (type: string) => {
    setForm(f => ({
      ...f,
      question_types: f.question_types.includes(type)
        ? f.question_types.filter(t => t !== type)
        : [...f.question_types, type],
    }))
  }

  const card = clsx('rounded-xl border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Quizzes</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> Generate Quiz
        </button>
      </div>

      {showForm && (
        <div className={clsx(card, 'p-5')}>
          <h2 className="font-semibold mb-4">Generate New Quiz</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Subject *</label>
              <select
                value={form.subject_id}
                onChange={e => setForm(f => ({ ...f, subject_id: e.target.value, title: `${subjects.find(s => s.id == e.target.value)?.name || ''} Quiz` }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                required
              >
                <option value="">Select subject…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Quiz Title</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                placeholder="e.g. Exception Handling Quiz"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Difficulty</label>
              <select
                value={form.difficulty}
                onChange={e => setForm(f => ({ ...f, difficulty: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Number of Questions</label>
              <input
                type="number"
                min={2}
                max={20}
                value={form.num_questions}
                onChange={e => setForm(f => ({ ...f, num_questions: parseInt(e.target.value) }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2">Question Types</label>
              <div className="flex flex-wrap gap-2">
                {['mcq', 'true_false', 'fill_blank', 'short_answer'].map(t => (
                  <label key={t} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.question_types.includes(t)}
                      onChange={() => toggleType(t)}
                    />
                    {t.replace('_', ' ')}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.timed} onChange={e => setForm(f => ({ ...f, timed: e.target.checked }))} />
                Timed
              </label>
              {form.timed && (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={form.time_limit_minutes}
                    onChange={e => setForm(f => ({ ...f, time_limit_minutes: parseInt(e.target.value) }))}
                    className={clsx('w-16 px-2 py-1 rounded border text-sm', isDark ? 'bg-slate-700 border-slate-600' : 'border-slate-300')}
                  />
                  <span className="text-xs">min</span>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.include_explanations} onChange={e => setForm(f => ({ ...f, include_explanations: e.target.checked }))} />
                Include explanations
              </label>
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button
                type="submit"
                disabled={generating}
                className={clsx('flex items-center gap-2 px-4 py-2 rounded-lg text-sm text-white transition-colors',
                  generating ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700')}
              >
                {generating ? <><div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" /> Generating…</> : 'Generate Quiz'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>
      ) : quizzes.length === 0 ? (
        <div className={clsx(card, 'p-12 text-center')}>
          <HelpCircle className="w-12 h-12 mx-auto mb-3 text-slate-400" />
          <h3 className="font-semibold mb-1">No quizzes yet</h3>
          <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>Generate your first quiz to start practicing</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {quizzes.map(q => (
            <div key={q.id} className={clsx(card, 'p-4')}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="font-semibold">{q.title}</h3>
                  <p className={clsx('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {q.total_questions} questions · {q.difficulty} · {q.question_types.join(', ')}
                  </p>
                </div>
                <button onClick={() => handleDelete(q.id)} className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-3">
                {q.timed && (
                  <span className={clsx('flex items-center gap-1 text-xs px-2 py-0.5 rounded-full', isDark ? 'bg-slate-700' : 'bg-slate-100')}>
                    <Clock className="w-3 h-3" /> {q.time_limit_minutes}min
                  </span>
                )}
                <button
                  onClick={() => navigate(`/quizzes/${q.id}/take`)}
                  className="flex items-center gap-1.5 ml-auto bg-green-600 hover:bg-green-700 text-white text-xs px-3 py-1.5 rounded-lg"
                >
                  <Play className="w-3.5 h-3.5" /> Take Quiz
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
