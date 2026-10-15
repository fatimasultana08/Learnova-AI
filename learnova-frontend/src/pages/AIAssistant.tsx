import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { aiApi, subjectsApi, documentsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { Send, Bot, User, Loader2, FileText, Sparkles } from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'
import { v4 as uuidv4 } from 'uuid'

const ACTIONS = [
  { key: 'explain', label: 'Explain' },
  { key: 'explain_exam', label: 'Exam Style' },
  { key: 'summarize', label: 'Summarize' },
  { key: 'notes', label: 'Notes' },
  { key: 'definitions', label: 'Definitions' },
  { key: 'flashcards', label: 'Flashcards' },
  { key: 'short_questions', label: 'Short Q&A' },
  { key: 'checklist', label: 'Checklist' },
]

export default function AIAssistant() {
  const [searchParams] = useSearchParams()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [sessionId] = useState(() => {
    const saved = sessionStorage.getItem('ai-session-id')
    if (saved) return saved
    const id = uuidv4()
    sessionStorage.setItem('ai-session-id', id)
    return id
  })

  const [messages, setMessages] = useState<any[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [subjects, setSubjects] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [documents, setDocuments] = useState<any[]>([])
  const [selectedDocs, setSelectedDocs] = useState<number[]>([])
  const [action, setAction] = useState<string | null>(null)
  const [providerStatus, setProviderStatus] = useState<any>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const subjectParam = searchParams.get('subject')
    if (subjectParam) setSelectedSubject(parseInt(subjectParam))

    const load = async () => {
      try {
        const [subjR, histR, provR] = await Promise.all([
          subjectsApi.list(false),
          aiApi.history(sessionId),
          aiApi.providerStatus(),
        ])
        setSubjects(subjR.data)
        setMessages(histR.data)
        setProviderStatus(provR.data)
      } catch { /* ignore */ }
    }
    load()
  }, [sessionId])

  useEffect(() => {
    if (selectedSubject) {
      documentsApi.list(selectedSubject).then(r => {
        const ready = r.data.filter((d: any) => d.status === 'ready')
        setDocuments(ready)
        setSelectedDocs([])
      })
    } else {
      setDocuments([])
      setSelectedDocs([])
    }
  }, [selectedSubject])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (text?: string) => {
    const msg = text || input.trim()
    if (!msg || loading) return
    setInput('')
    setLoading(true)

    const userMsg = { id: Date.now(), role: 'user', content: msg, created_at: new Date().toISOString() }
    setMessages(prev => [...prev, userMsg])

    try {
      const r = await aiApi.chat({
        question: msg,
        session_id: sessionId,
        subject_id: selectedSubject,
        document_ids: selectedDocs.length > 0 ? selectedDocs : undefined,
        action,
      })
      setMessages(prev => [...prev.filter(m => m.id !== userMsg.id), userMsg, r.data])
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'AI request failed')
      setMessages(prev => prev.filter(m => m.id !== userMsg.id))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const card = clsx(
    'rounded-xl border',
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  )

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-8rem)] flex flex-col gap-4">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bot className="w-6 h-6 text-purple-500" /> AI Study Assistant
          </h1>
          {providerStatus && (
            <p className={clsx('text-xs mt-0.5', isDark ? 'text-slate-400' : 'text-slate-500')}>
              Provider: <span className="font-medium">{providerStatus.active_provider}</span>
              {providerStatus.dev_mode && (
                <span className="ml-2 text-yellow-500">⚠️ Dev mode — configure API keys for real AI</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className={clsx(card, 'p-4 shrink-0 space-y-3')}>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium mb-1">Subject (optional)</label>
            <select
              value={selectedSubject ?? ''}
              onChange={e => setSelectedSubject(e.target.value ? parseInt(e.target.value) : null)}
              className={clsx(
                'w-full px-3 py-2 rounded-lg border text-sm outline-none',
                isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
              )}
            >
              <option value="">No subject filter</option>
              {subjects.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          {documents.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1">Source Documents</label>
              <div className="flex flex-wrap gap-2">
                {documents.map(d => (
                  <label key={d.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedDocs.includes(d.id)}
                      onChange={e => {
                        if (e.target.checked) setSelectedDocs(prev => [...prev, d.id])
                        else setSelectedDocs(prev => prev.filter(x => x !== d.id))
                      }}
                    />
                    <FileText className="w-3 h-3 text-blue-400" />
                    <span className="truncate max-w-[120px]">{d.original_name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Quick Action</label>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setAction(null)}
              className={clsx(
                'text-xs px-2.5 py-1 rounded-full border transition-colors',
                action === null ? 'bg-blue-600 text-white border-blue-600' :
                isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-50'
              )}
            >
              Chat
            </button>
            {ACTIONS.map(a => (
              <button
                key={a.key}
                onClick={() => setAction(a.key)}
                className={clsx(
                  'text-xs px-2.5 py-1 rounded-full border transition-colors',
                  action === a.key ? 'bg-blue-600 text-white border-blue-600' :
                  isDark ? 'border-slate-600 hover:bg-slate-700' : 'border-slate-300 hover:bg-slate-50'
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className={clsx(card, 'flex-1 overflow-y-auto p-4 space-y-4')}>
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Sparkles className="w-12 h-12 text-purple-400 mb-3" />
            <h3 className="font-semibold mb-1">Ask anything about your studies</h3>
            <p className={clsx('text-sm', isDark ? 'text-slate-400' : 'text-slate-500')}>
              Upload PDFs in your subject and I'll answer from your own materials with citations.
            </p>
          </div>
        )}
        {messages.map(msg => (
          <div key={msg.id} className={clsx('flex gap-3', msg.role === 'user' ? 'flex-row-reverse' : '')}>
            <div className={clsx(
              'w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-1',
              msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'
            )}>
              {msg.role === 'user'
                ? <User className="w-4 h-4 text-white" />
                : <Bot className="w-4 h-4 text-white" />
              }
            </div>
            <div className={clsx('max-w-[80%] space-y-2')}>
              <div className={clsx(
                'rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-tr-none'
                  : isDark ? 'bg-slate-700 rounded-tl-none' : 'bg-slate-100 rounded-tl-none'
              )}>
                {msg.content}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className={clsx(
                  'text-xs rounded-lg p-3 space-y-1',
                  isDark ? 'bg-slate-700/50' : 'bg-blue-50'
                )}>
                  <p className="font-medium text-blue-600">📚 Sources:</p>
                  {msg.sources.map((s: any, i: number) => (
                    <div key={i} className={clsx(isDark ? 'text-slate-300' : 'text-slate-600')}>
                      <span className="font-medium">{s.document_name}</span> — page {s.page}
                      {s.excerpt && (
                        <p className="mt-0.5 italic text-xs opacity-70">"{s.excerpt}"</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-white animate-spin" />
            </div>
            <div className={clsx('rounded-2xl px-4 py-3 text-sm rounded-tl-none',
              isDark ? 'bg-slate-700' : 'bg-slate-100')}>
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className={clsx(card, 'p-3 shrink-0 flex gap-2')}>
        <textarea
          rows={2}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
          className={clsx(
            'flex-1 resize-none px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-purple-500',
            isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
          )}
        />
        <button
          onClick={() => sendMessage()}
          disabled={!input.trim() || loading}
          className={clsx(
            'px-4 rounded-lg transition-colors',
            input.trim() && !loading
              ? 'bg-purple-600 hover:bg-purple-700 text-white'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          )}
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}
