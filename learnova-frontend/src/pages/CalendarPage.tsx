import { useEffect, useState } from 'react'
import { calendarApi, subjectsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { Plus, Trash2, Edit2, ChevronLeft, ChevronRight } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameDay, isSameMonth, addMonths, subMonths, isToday, parseISO
} from 'date-fns'

const CATEGORY_COLORS: Record<string, string> = {
  exam: 'bg-red-500',
  assignment: 'bg-blue-500',
  quiz: 'bg-yellow-500',
  revision: 'bg-purple-500',
  reminder: 'bg-green-500',
  personal: 'bg-slate-500',
}

export default function CalendarPage() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [events, setEvents] = useState<any[]>([])
  const [subjects, setSubjects] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editEvent, setEditEvent] = useState<any>(null)
  const [form, setForm] = useState({
    title: '', category: 'exam', subject_id: '', start_date: '', end_date: '',
    all_day: true, priority: 'medium', notes: '', reminder_minutes: '',
  })

  const load = async () => {
    const start = format(startOfMonth(currentMonth), "yyyy-MM-dd'T'HH:mm:ss")
    const end = format(endOfMonth(currentMonth), "yyyy-MM-dd'T'HH:mm:ss")
    try {
      const [eR, sR] = await Promise.all([
        calendarApi.list(start, end),
        subjectsApi.list(false),
      ])
      setEvents(eR.data)
      setSubjects(sR.data)
    } catch { toast.error('Failed to load calendar') }
  }

  useEffect(() => { load() }, [currentMonth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim() || !form.start_date) return
    try {
      const payload = {
        ...form,
        subject_id: form.subject_id ? parseInt(form.subject_id) : null,
        start_date: new Date(form.start_date).toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        reminder_minutes: form.reminder_minutes ? parseInt(form.reminder_minutes) : null,
      }
      if (editEvent) {
        await calendarApi.update(editEvent.id, payload)
        toast.success('Event updated')
      } else {
        await calendarApi.create(payload)
        toast.success('Event created')
      }
      setShowForm(false)
      setEditEvent(null)
      setForm({ title: '', category: 'exam', subject_id: '', start_date: '', end_date: '', all_day: true, priority: 'medium', notes: '', reminder_minutes: '' })
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Failed to save event')
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this event?')) return
    await calendarApi.delete(id)
    setEvents(prev => prev.filter(e => e.id !== id))
    toast.success('Event deleted')
  }

  const openAddForm = (day: Date) => {
    setEditEvent(null)
    setForm(f => ({
      ...f,
      title: '',
      start_date: format(day, 'yyyy-MM-dd'),
    }))
    setShowForm(true)
  }

  const openEditForm = (event: any) => {
    setEditEvent(event)
    setForm({
      title: event.title,
      category: event.category,
      subject_id: event.subject_id?.toString() || '',
      start_date: event.start_date?.split('T')[0] || '',
      end_date: event.end_date?.split('T')[0] || '',
      all_day: event.all_day,
      priority: event.priority,
      notes: event.notes,
      reminder_minutes: event.reminder_minutes?.toString() || '',
    })
    setShowForm(true)
  }

  // Build calendar grid
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart)
  const calEnd = endOfWeek(monthEnd)
  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const card = clsx('rounded-xl border', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <button
          onClick={() => openAddForm(new Date())}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> Add Event
        </button>
      </div>

      {/* Event form */}
      {showForm && (
        <div className={clsx(card, 'p-5')}>
          <h2 className="font-semibold mb-4">{editEvent ? 'Edit Event' : 'New Event'}</h2>
          <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Title *</label>
              <input type="text" required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                placeholder="e.g. Java Final Exam" />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}>
                {Object.keys(CATEGORY_COLORS).map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Date *</label>
              <input type="date" required value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')} />
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
              <label className="block text-xs font-medium mb-1">Priority</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Reminder (minutes before)</label>
              <input type="number" value={form.reminder_minutes} onChange={e => setForm(f => ({ ...f, reminder_minutes: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                placeholder="e.g. 60" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-medium mb-1">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none resize-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')} />
            </div>
            <div className="md:col-span-2 flex gap-3">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
                {editEvent ? 'Update' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-600">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Month navigation */}
      <div className={clsx(card, 'p-4')}>
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className={clsx('text-center text-xs font-medium py-2', isDark ? 'text-slate-400' : 'text-slate-500')}>{d}</div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dayEvents = events.filter(e => isSameDay(parseISO(e.start_date), day))
            const inMonth = isSameMonth(day, currentMonth)
            const today = isToday(day)
            return (
              <div
                key={day.toISOString()}
                onClick={() => openAddForm(day)}
                className={clsx(
                  'min-h-[60px] p-1 rounded-lg cursor-pointer transition-colors',
                  today ? 'ring-2 ring-blue-500' : '',
                  inMonth
                    ? isDark ? 'bg-slate-700 hover:bg-slate-600' : 'bg-slate-50 hover:bg-slate-100'
                    : isDark ? 'bg-slate-800/50 text-slate-600' : 'bg-white text-slate-300'
                )}
              >
                <div className={clsx(
                  'text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1',
                  today ? 'bg-blue-600 text-white' : ''
                )}>
                  {format(day, 'd')}
                </div>
                {dayEvents.slice(0, 2).map(ev => (
                  <div
                    key={ev.id}
                    onClick={e => { e.stopPropagation(); openEditForm(ev) }}
                    className={clsx(
                      'text-xs px-1 py-0.5 rounded mb-0.5 text-white truncate cursor-pointer',
                      CATEGORY_COLORS[ev.category] || 'bg-slate-500'
                    )}
                    title={ev.title}
                  >
                    {ev.title}
                  </div>
                ))}
                {dayEvents.length > 2 && (
                  <div className="text-xs text-slate-400">+{dayEvents.length - 2} more</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Upcoming events list */}
      <div className={clsx(card, 'p-4')}>
        <h2 className="font-semibold mb-3">All Events This Month</h2>
        {events.length === 0 ? (
          <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>No events this month</p>
        ) : (
          <div className="space-y-2">
            {events.sort((a, b) => new Date(a.start_date).getTime() - new Date(b.start_date).getTime()).map(ev => (
              <div key={ev.id} className={clsx('flex items-center gap-3 px-3 py-2 rounded-lg', isDark ? 'bg-slate-700' : 'bg-slate-50')}>
                <div className={clsx('w-2 h-2 rounded-full shrink-0', CATEGORY_COLORS[ev.category])} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{ev.title}</p>
                  <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {format(parseISO(ev.start_date), 'MMM d, yyyy')} · {ev.category} · {ev.priority}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => openEditForm(ev)} className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-600">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(ev.id)} className="p-1.5 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
