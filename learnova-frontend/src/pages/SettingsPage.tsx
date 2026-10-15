import React, { useEffect, useState } from 'react'
import { settingsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { Save, Sun, Moon } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { theme, toggle } = useTheme()
  const isDark = theme === 'dark'
  const [settings, setSettings] = useState<any>(null)
  const [form, setForm] = useState<any>({
    student_name: '',
    pomodoro_focus_minutes: 25,
    pomodoro_short_break: 5,
    pomodoro_long_break: 15,
    daily_study_goal_minutes: 120,
    preferred_study_times: ['morning'],
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    settingsApi.get().then(r => {
      setSettings(r.data)
      setForm({
        student_name: r.data.student_name,
        pomodoro_focus_minutes: r.data.pomodoro_focus_minutes,
        pomodoro_short_break: r.data.pomodoro_short_break,
        pomodoro_long_break: r.data.pomodoro_long_break,
        daily_study_goal_minutes: r.data.daily_study_goal_minutes,
        preferred_study_times: r.data.preferred_study_times,
      })
    })
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await settingsApi.update(form)
      toast.success('Settings saved')
    } catch {
      toast.error('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const card = clsx('rounded-xl border p-5', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  if (!settings) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Settings</h1>

      <form onSubmit={save} className="space-y-6">
        {/* Profile */}
        <div className={card}>
          <h2 className="font-semibold mb-4">Profile</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Your Name</label>
            <input
              type="text"
              value={form.student_name}
              onChange={e => setForm((f: any) => ({ ...f, student_name: e.target.value }))}
              className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
            />
          </div>
        </div>

        {/* Appearance */}
        <div className={card}>
          <h2 className="font-semibold mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <span className="text-sm">Theme</span>
            <button
              type="button"
              onClick={toggle}
              className={clsx(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition-colors',
                isDark ? 'border-slate-600 bg-slate-700' : 'border-slate-300 bg-slate-50'
              )}
            >
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
              {isDark ? 'Dark mode' : 'Light mode'}
            </button>
          </div>
        </div>

        {/* Focus Timer */}
        <div className={card}>
          <h2 className="font-semibold mb-4">Focus Timer Defaults</h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { key: 'pomodoro_focus_minutes', label: 'Focus (min)' },
              { key: 'pomodoro_short_break', label: 'Short break' },
              { key: 'pomodoro_long_break', label: 'Long break' },
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block text-xs font-medium mb-1">{label}</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={form[key]}
                  onChange={e => setForm((f: any) => ({ ...f, [key]: parseInt(e.target.value) }))}
                  className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Study Goals */}
        <div className={card}>
          <h2 className="font-semibold mb-4">Study Goals</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Daily Study Goal (minutes)</label>
            <input
              type="number"
              min={15}
              max={600}
              value={form.daily_study_goal_minutes}
              onChange={e => setForm((f: any) => ({ ...f, daily_study_goal_minutes: parseInt(e.target.value) }))}
              className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium mb-2">Preferred Study Times</label>
            <div className="flex flex-wrap gap-2">
              {['morning', 'afternoon', 'evening', 'night'].map(t => (
                <label key={t} className="flex items-center gap-1.5 text-sm cursor-pointer capitalize">
                  <input
                    type="checkbox"
                    checked={form.preferred_study_times.includes(t)}
                    onChange={e => {
                      if (e.target.checked) setForm((f: any) => ({ ...f, preferred_study_times: [...f.preferred_study_times, t] }))
                      else setForm((f: any) => ({ ...f, preferred_study_times: f.preferred_study_times.filter((x: string) => x !== t) }))
                    }}
                  />
                  {t}
                </label>
              ))}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className={clsx(
            'flex items-center gap-2 px-6 py-2.5 rounded-xl text-white font-medium transition-colors',
            saving ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-700'
          )}
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving…' : 'Save Settings'}
        </button>
      </form>
    </div>
  )
}
