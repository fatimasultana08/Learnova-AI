import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { chaptersApi, subjectsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import { FileText } from 'lucide-react'
import clsx from 'clsx'

export default function Notes() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const [subjects, setSubjects] = useState<any[]>([])
  const [chapters, setChapters] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<number | null>(null)
  const [selectedChapter, setSelectedChapter] = useState<any | null>(null)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    subjectsApi.list(false).then(r => setSubjects(r.data))
  }, [])

  useEffect(() => {
    if (selectedSubject) {
      chaptersApi.list(selectedSubject).then(r => setChapters(r.data))
    }
  }, [selectedSubject])

  useEffect(() => {
    if (selectedChapter) setNoteText(selectedChapter.notes || '')
  }, [selectedChapter])

  const saveNotes = async () => {
    if (!selectedChapter) return
    setSaving(true)
    try {
      await chaptersApi.update(selectedChapter.id, { notes: noteText })
      setSelectedChapter((c: any) => ({ ...c, notes: noteText }))
    } finally {
      setSaving(false)
    }
  }

  const card = clsx('rounded-xl border p-5', isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200')

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Notes</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {/* Selector */}
        <div className={clsx(card, 'space-y-3 md:col-span-1')}>
          <div>
            <label className="block text-xs font-medium mb-1">Subject</label>
            <select
              value={selectedSubject ?? ''}
              onChange={e => { setSelectedSubject(e.target.value ? parseInt(e.target.value) : null); setSelectedChapter(null) }}
              className={clsx('w-full px-3 py-2 rounded-lg border text-sm outline-none', isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300')}
            >
              <option value="">Select subject…</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          {chapters.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-1">Chapter</label>
              <div className="space-y-1">
                {chapters.map(ch => (
                  <button
                    key={ch.id}
                    onClick={() => setSelectedChapter(ch)}
                    className={clsx(
                      'w-full text-left text-sm px-3 py-2 rounded-lg transition-colors',
                      selectedChapter?.id === ch.id
                        ? 'bg-blue-600 text-white'
                        : isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-50'
                    )}
                  >
                    {ch.title}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Editor */}
        <div className={clsx(card, 'md:col-span-2 flex flex-col gap-3')}>
          {!selectedChapter ? (
            <div className="flex flex-col items-center justify-center h-48 text-center">
              <FileText className="w-10 h-10 mb-2 text-slate-400" />
              <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>Select a chapter to view or edit notes</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{selectedChapter.title}</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => navigate(`/ai?subject=${selectedSubject}`)}
                    className="text-xs bg-purple-600 text-white px-3 py-1.5 rounded-lg"
                  >
                    Generate with AI
                  </button>
                  <button
                    onClick={saveNotes}
                    disabled={saving}
                    className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <textarea
                rows={20}
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                className={clsx(
                  'flex-1 w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500 resize-none font-mono',
                  isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
                )}
                placeholder="Start typing your notes here, or click 'Generate with AI' to create AI-powered notes from your uploaded PDFs…"
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
