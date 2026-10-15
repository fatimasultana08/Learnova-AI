import { useEffect, useState, useRef, useCallback } from 'react'
import { sessionsApi, subjectsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { Play, Pause, RotateCcw, Timer, Clock } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

type Mode = 'pomodoro' | 'stopwatch'
type Phase = 'focus' | 'short_break' | 'long_break'

export default function FocusTimer() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [mode, setMode] = useState<Mode>('pomodoro')
  const [phase, setPhase] = useState<Phase>('focus')
  const [focusMin, setFocusMin] = useState(25)
  const [shortBreak, setShortBreak] = useState(5)
  const [longBreak, setLongBreak] = useState(15)
  const [timeLeft, setTimeLeft] = useState(focusMin * 60)
  const [running, setRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [sessionId, setSessionId] = useState<number | null>(null)
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [sessions, setSessions] = useState<any[]>([])
  const [sessionNotes, setSessionNotes] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const [completedSessions, setCompletedSessions] = useState(0)

  useEffect(() => {
    subjectsApi.list(false).then(r => setSubjects(r.data))
    sessionsApi.list({}).then(r => setSessions(r.data.slice(0, 10)))
  }, [])

  useEffect(() => {
    setTimeLeft(mode === 'pomodoro' ? focusMin * 60 : 0)
    setElapsed(0)
    setRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }, [mode, focusMin])

  const phaseTime = useCallback(() => {
    if (phase === 'focus') return focusMin * 60
    if (phase === 'short_break') return shortBreak * 60
    return longBreak * 60
  }, [phase, focusMin, shortBreak, longBreak])

  useEffect(() => {
    if (mode === 'pomodoro') setTimeLeft(phaseTime())
  }, [phase])

  const tick = useCallback(() => {
    if (mode === 'pomodoro') {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleSessionEnd()
          return 0
        }
        return prev - 1
      })
    } else {
      setElapsed(prev => prev + 1)
    }
  }, [mode])

  const handleSessionEnd = async () => {
    setRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)

    if (phase === 'focus' && sessionId) {
      const actualMin = (focusMin * 60 - timeLeft) / 60 + focusMin
      try {
        await sessionsApi.update(sessionId, {
          actual_minutes: Math.max(actualMin, focusMin),
          completed: true,
          ended_at: new Date().toISOString(),
          notes: sessionNotes,
        })
        toast.success('Focus session completed! 🎉')
        setCompletedSessions(c => c + 1)
        setSessions(prev => prev)
        sessionsApi.list({}).then(r => setSessions(r.data.slice(0, 10)))
      } catch { /* ignore */ }

      // Auto-start break
      setPhase(completedSessions % 3 === 2 ? 'long_break' : 'short_break')
    } else if (phase !== 'focus') {
      toast('Break over! Ready for next session.', { icon: '⏰' })
      setPhase('focus')
    }
  }

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(tick, 1000)
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, tick])

  const start = async () => {
    if (!running) {
      if (phase === 'focus' && !sessionId) {
        try {
          const r = await sessionsApi.create({
            subject_id: selectedSubject,
            mode: 'pomodoro',
            planned_minutes: focusMin,
          })
          setSessionId(r.data.id)
        } catch { /* ignore */ }
      }
      startTimeRef.current = Date.now()
      setRunning(true)
    }
  }

  const pause = () => setRunning(false)

  const reset = () => {
    setRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)
    setTimeLeft(phaseTime())
    setElapsed(0)
    setSessionId(null)
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const totalSecs = mode === 'pomodoro' ? phaseTime() : null
  const progress = totalSecs ? ((totalSecs - timeLeft) / totalSecs) * 100 : null
  const displayTime = mode === 'pomodoro' ? formatTime(timeLeft) : formatTime(elapsed)

  const PHASE_COLORS: Record<Phase, string> = {
    focus: '#3b82f6',
    short_break: '#22c55e',
    long_break: '#7c5cd8',
  }

  const card = clsx('rounded-xl border p-5', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Focus Timer</h1>

      {/* Mode tabs */}
      <div className={clsx('inline-flex rounded-xl p-1', isDark ? 'bg-slate-800' : 'bg-slate-100')}>
        {(['pomodoro', 'stopwatch'] as Mode[]).map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={clsx(
              'px-4 py-2 rounded-lg text-sm font-medium capitalize transition-colors',
              mode === m ? 'bg-blue-600 text-white' : isDark ? 'text-slate-400' : 'text-slate-600'
            )}
          >
            {m === 'pomodoro' ? '🍅 Pomodoro' : '⏱ Stopwatch'}
          </button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Timer */}
        <div className={card}>
          {mode === 'pomodoro' && (
            <div className="flex gap-2 mb-4">
              {(['focus', 'short_break', 'long_break'] as Phase[]).map(p => (
                <button
                  key={p}
                  onClick={() => { setPhase(p); setRunning(false) }}
                  className={clsx(
                    'text-xs px-3 py-1.5 rounded-full border transition-colors',
                    phase === p ? 'text-white border-transparent' : isDark ? 'border-slate-600' : 'border-slate-200'
                  )}
                  style={phase === p ? { background: PHASE_COLORS[p] } : {}}
                >
                  {p.replace('_', ' ')}
                </button>
              ))}
            </div>
          )}

          {/* Circular timer */}
          <div className="flex flex-col items-center py-6">
            <div className="relative w-48 h-48">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50" cy="50" r="45"
                  fill="none"
                  stroke={isDark ? '#334155' : '#e2e8f0'}
                  strokeWidth="8"
                />
                {progress !== null && (
                  <circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke={PHASE_COLORS[phase]}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 45}`}
                    strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
                    className="transition-all duration-1000"
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-mono font-bold">{displayTime}</span>
                {mode === 'pomodoro' && (
                  <span className={clsx('text-xs mt-1', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {phase.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3 mt-6">
              {!running ? (
                <button
                  onClick={start}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-xl font-medium"
                >
                  <Play className="w-4 h-4" /> Start
                </button>
              ) : (
                <button
                  onClick={pause}
                  className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 text-white px-6 py-2.5 rounded-xl font-medium"
                >
                  <Pause className="w-4 h-4" /> Pause
                </button>
              )}
              <button
                onClick={reset}
                className={clsx('p-2.5 rounded-xl border transition-colors', isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-200 hover:bg-slate-50')}
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Session info */}
          <div className="border-t pt-4 space-y-3" style={{ borderColor: isDark ? '#334155' : '#e2e8f0' }}>
            <div>
              <label className="block text-xs font-medium mb-1">Subject</label>
              <select
                value={selectedSubject ?? ''}
                onChange={e => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
              >
                <option value="">None</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Session Notes</label>
              <input
                type="text"
                value={sessionNotes}
                onChange={e => setSessionNotes(e.target.value)}
                className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
                placeholder="What are you studying?"
              />
            </div>
            {mode === 'pomodoro' && (
              <div className="flex gap-4 text-xs">
                <div>
                  <label className="block font-medium mb-1">Focus (min)</label>
                  <input type="number" min={5} max={90} value={focusMin}
                    onChange={e => setFocusMin(parseInt(e.target.value))}
                    className={clsx('w-16 px-2 py-1 rounded border text-center', isDark ? 'bg-slate-700 border-slate-600' : 'border-slate-300')} />
                </div>
                <div>
                  <label className="block font-medium mb-1">Short break</label>
                  <input type="number" min={1} max={30} value={shortBreak}
                    onChange={e => setShortBreak(parseInt(e.target.value))}
                    className={clsx('w-16 px-2 py-1 rounded border text-center', isDark ? 'bg-slate-700 border-slate-600' : 'border-slate-300')} />
                </div>
                <div>
                  <label className="block font-medium mb-1">Long break</label>
                  <input type="number" min={5} max={60} value={longBreak}
                    onChange={e => setLongBreak(parseInt(e.target.value))}
                    className={clsx('w-16 px-2 py-1 rounded border text-center', isDark ? 'bg-slate-700 border-slate-600' : 'border-slate-300')} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Session history */}
        <div className={card}>
          <h2 className="font-semibold mb-3">Recent Sessions</h2>
          {sessions.length === 0 ? (
            <div className="text-center py-8">
              <Timer className="w-10 h-10 mx-auto mb-2 text-slate-400" />
              <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
                No sessions yet. Start your first focus session!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map(s => (
                <div key={s.id} className={clsx('flex items-center gap-3 px-3 py-2 rounded-lg', isDark ? 'bg-slate-700' : 'bg-slate-50')}>
                  <Clock className={clsx('w-4 h-4 shrink-0', s.completed ? 'text-green-500' : 'text-slate-400')} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">
                      {Math.round(s.actual_minutes)} min
                      {s.completed ? ' ✓' : ' (incomplete)'}
                    </p>
                    <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                      {new Date(s.created_at).toLocaleDateString()} {s.notes ? `· ${s.notes}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className={clsx('mt-4 pt-4 border-t text-center', isDark ? 'border-slate-700' : 'border-slate-200')}>
            <p className="text-2xl font-bold text-blue-500">{completedSessions}</p>
            <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>sessions this window</p>
          </div>
        </div>
      </div>
    </div>
  )
}
