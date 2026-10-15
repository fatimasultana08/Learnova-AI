import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { quizzesApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { CheckCircle2, XCircle, Flag, Clock } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

export default function QuizTake() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [quiz, setQuiz] = useState<any>(null)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)
  const [attempt, setAttempt] = useState<any>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    quizzesApi.get(parseInt(id!)).then(r => {
      setQuiz(r.data)
      if (r.data.timed && r.data.time_limit_minutes) {
        setTimeLeft(r.data.time_limit_minutes * 60)
      }
    })
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [id])

  useEffect(() => {
    if (timeLeft === null || submitted) return
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null || prev <= 1) {
          handleSubmit(true)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [timeLeft !== null, submitted])

  const handleSubmit = async (autoSubmit = false) => {
    if (!quiz || submitted) return
    if (!autoSubmit && !confirm('Submit quiz?')) return
    if (timerRef.current) clearInterval(timerRef.current)

    const timeTaken = Math.round((Date.now() - startTimeRef.current) / 1000)
    try {
      const r = await quizzesApi.submitAttempt(quiz.id, {
        answers,
        time_taken_seconds: timeTaken,
      })
      setAttempt(r.data)
      setSubmitted(true)
      toast.success(`Quiz submitted! Score: ${r.data.score ?? 'N/A'}%`)
    } catch {
      toast.error('Failed to submit quiz')
    }
  }

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = secs % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const card = clsx('rounded-xl border p-5', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  if (!quiz) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
    </div>
  )

  if (submitted && attempt) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className={clsx(card, 'text-center')}>
          <div className={clsx('text-6xl font-bold mb-2', attempt.score >= 70 ? 'text-green-500' : 'text-red-500')}>
            {attempt.score !== null ? `${attempt.score}%` : 'N/A'}
          </div>
          <p className="text-lg font-semibold mb-4">{attempt.score >= 70 ? 'Well done!' : 'Keep practicing!'}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => navigate('/quizzes')} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm">
              Back to Quizzes
            </button>
            <button onClick={() => { setSubmitted(false); setAnswers({}); setAttempt(null); startTimeRef.current = Date.now() }} className="border border-slate-300 px-4 py-2 rounded-lg text-sm">
              Retake
            </button>
          </div>
        </div>
        {/* Review */}
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">Review Answers</h2>
          {quiz.questions.map((q: any, i: number) => {
            const userAns = attempt.answers[String(q.id)] || ''
            const isCorrect = userAns.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
            return (
              <div key={q.id} className={clsx(card)}>
                <div className="flex items-start gap-3">
                  {isCorrect
                    ? <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5 shrink-0" />
                    : <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                  }
                  <div className="flex-1">
                    <p className="font-medium text-sm mb-2">Q{i + 1}. {q.question_text}</p>
                    {q.options && (
                      <div className="space-y-1 mb-2">
                        {q.options.map((opt: string) => (
                          <div key={opt} className={clsx(
                            'text-xs px-3 py-1.5 rounded',
                            opt.toLowerCase().trim() === q.correct_answer.toLowerCase().trim()
                              ? 'bg-green-100 text-green-700'
                              : userAns.toLowerCase().trim() === opt.toLowerCase().trim() && !isCorrect
                                ? 'bg-red-100 text-red-700'
                                : isDark ? 'bg-slate-700' : 'bg-slate-100'
                          )}>{opt}</div>
                        ))}
                      </div>
                    )}
                    {!q.options && (
                      <div className="text-xs mb-2">
                        <span className="text-slate-500">Your answer: </span>
                        <span>{userAns || '(blank)'}</span>
                      </div>
                    )}
                    <div className={clsx('text-xs', isCorrect ? 'text-green-600' : 'text-red-600')}>
                      Correct: {q.correct_answer}
                    </div>
                    {q.explanation && (
                      <div className={clsx('mt-2 text-xs p-2 rounded', isDark ? 'bg-slate-700' : 'bg-blue-50')}>
                        💡 {q.explanation}
                      </div>
                    )}
                    {q.source_reference && (
                      <div className="mt-1 text-xs text-slate-400">📄 {q.source_reference}</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">{quiz.title}</h1>
        {timeLeft !== null && (
          <div className={clsx(
            'flex items-center gap-2 px-3 py-1.5 rounded-lg font-mono',
            timeLeft <= 60 ? 'bg-red-100 text-red-700' : isDark ? 'bg-slate-800' : 'bg-slate-100'
          )}>
            <Clock className="w-4 h-4" />
            {formatTime(timeLeft)}
          </div>
        )}
      </div>

      {/* Progress */}
      <div className={clsx('h-1.5 rounded-full overflow-hidden', isDark ? 'bg-slate-700' : 'bg-slate-200')}>
        <div
          className="h-full bg-blue-600 rounded-full transition-all"
          style={{ width: `${(Object.keys(answers).length / quiz.questions.length) * 100}%` }}
        />
      </div>
      <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
        {Object.keys(answers).length} / {quiz.questions.length} answered
      </p>

      {/* Questions */}
      {quiz.questions.map((q: any, i: number) => (
        <div key={q.id} className={card}>
          <div className="flex items-start justify-between mb-3">
            <p className="font-medium text-sm">Q{i + 1}. {q.question_text}</p>
            <button
              onClick={async () => {
                await quizzesApi.flagQuestion(q.id)
                toast.success('Question flagged for review')
              }}
              className="p-1 rounded hover:bg-orange-100"
              title="Flag as questionable"
            >
              <Flag className="w-4 h-4 text-orange-400" />
            </button>
          </div>

          {q.question_type === 'mcq' && q.options && (
            <div className="space-y-2">
              {q.options.map((opt: string) => (
                <label key={opt} className={clsx(
                  'flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer transition-colors',
                  answers[String(q.id)] === opt
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : isDark ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-200 hover:bg-slate-50'
                )}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt}
                    checked={answers[String(q.id)] === opt}
                    onChange={() => setAnswers(prev => ({ ...prev, [String(q.id)]: opt }))}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{opt}</span>
                </label>
              ))}
            </div>
          )}

          {q.question_type === 'true_false' && (
            <div className="flex gap-3">
              {['True', 'False'].map(opt => (
                <label key={opt} className={clsx(
                  'flex items-center gap-2 px-4 py-2 rounded-xl border cursor-pointer transition-colors',
                  answers[String(q.id)] === opt
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : isDark ? 'border-slate-700 hover:bg-slate-700' : 'border-slate-200 hover:bg-slate-50'
                )}>
                  <input
                    type="radio"
                    name={`q-${q.id}`}
                    value={opt}
                    checked={answers[String(q.id)] === opt}
                    onChange={() => setAnswers(prev => ({ ...prev, [String(q.id)]: opt }))}
                    className="w-4 h-4"
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}

          {(q.question_type === 'fill_blank' || q.question_type === 'short_answer') && (
            <input
              type="text"
              value={answers[String(q.id)] || ''}
              onChange={e => setAnswers(prev => ({ ...prev, [String(q.id)]: e.target.value }))}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500',
                isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
              )}
              placeholder="Your answer…"
            />
          )}
        </div>
      ))}

      <button
        onClick={() => handleSubmit()}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-3 rounded-xl font-medium transition-colors"
      >
        Submit Quiz
      </button>
    </div>
  )
}
