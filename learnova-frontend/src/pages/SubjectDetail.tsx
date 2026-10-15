import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { subjectsApi, chaptersApi, documentsApi } from '../api'
import { useTheme } from '../context/ThemeContext'
import {
  BookOpen, Plus, Trash2, Upload, FileText, ChevronLeft,
  CheckCircle2, Clock, AlertCircle, RefreshCw, Bot
} from 'lucide-react'
import clsx from 'clsx'
import toast from 'react-hot-toast'

const STATUS_STYLES: Record<string, string> = {
  not_started: 'bg-slate-100 text-slate-600',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  needs_revision: 'bg-orange-100 text-orange-700',
}
const STATUS_ICONS: Record<string, any> = {
  not_started: Clock,
  in_progress: RefreshCw,
  completed: CheckCircle2,
  needs_revision: AlertCircle,
}

export default function SubjectDetail() {
  const { id } = useParams<{ id: string }>()
  const subjectId = parseInt(id!)
  const navigate = useNavigate()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [subject, setSubject] = useState<any>(null)
  const [chapters, setChapters] = useState<any[]>([])
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showChapterForm, setShowChapterForm] = useState(false)
  const [chapterForm, setChapterForm] = useState({ title: '', difficulty: 'medium' })
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [sR, cR, dR] = await Promise.all([
        subjectsApi.get(subjectId),
        chaptersApi.list(subjectId),
        documentsApi.list(subjectId),
      ])
      setSubject(sR.data)
      setChapters(cR.data)
      setDocuments(dR.data)
    } catch {
      toast.error('Failed to load subject')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [subjectId])

  const addChapter = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chapterForm.title.trim()) return
    try {
      await chaptersApi.create({
        subject_id: subjectId,
        title: chapterForm.title,
        order_index: chapters.length,
        difficulty: chapterForm.difficulty,
      })
      toast.success('Chapter added')
      setChapterForm({ title: '', difficulty: 'medium' })
      setShowChapterForm(false)
      load()
    } catch {
      toast.error('Failed to add chapter')
    }
  }

  const updateStatus = async (chapterId: number, status: string) => {
    try {
      await chaptersApi.update(chapterId, { status })
      setChapters(prev => prev.map(c => c.id === chapterId ? { ...c, status } : c))
    } catch {
      toast.error('Failed to update status')
    }
  }

  const deleteChapter = async (chapterId: number) => {
    if (!confirm('Delete this chapter?')) return
    try {
      await chaptersApi.delete(chapterId)
      setChapters(prev => prev.filter(c => c.id !== chapterId))
      toast.success('Chapter deleted')
    } catch {
      toast.error('Failed to delete chapter')
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.pdf')) {
      toast.error('Only PDF files are supported')
      return
    }
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    fd.append('subject_id', subjectId.toString())
    try {
      await documentsApi.upload(fd)
      toast.success('PDF uploaded! Processing in background…')
      load()
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || 'Upload failed')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const deleteDocument = async (docId: number) => {
    if (!confirm('Delete this document and its indexed content?')) return
    try {
      await documentsApi.delete(docId)
      setDocuments(prev => prev.filter(d => d.id !== docId))
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const card = clsx(
    'rounded-xl border p-5',
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" />
      </div>
    )
  }

  if (!subject) return <div className="text-center py-20 text-slate-400">Subject not found</div>

  const completedCount = chapters.filter(c => c.status === 'completed').length
  const pct = chapters.length > 0 ? Math.round((completedCount / chapters.length) * 100) : 0

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/subjects')} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: subject.color + '20' }}
        >
          <BookOpen className="w-5 h-5" style={{ color: subject.color }} />
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{subject.name}</h1>
          <div className="flex items-center gap-4 text-sm text-slate-500 mt-0.5">
            <span>{chapters.length} chapters</span>
            <span>{pct}% complete</span>
            {subject.exam_date && (
              <span className="text-orange-500">
                Exam: {new Date(subject.exam_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={() => navigate(`/ai?subject=${subjectId}`)}
          className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm"
        >
          <Bot className="w-4 h-4" /> Ask AI
        </button>
      </div>

      {/* Progress */}
      <div className={card}>
        <div className="flex justify-between text-sm mb-2">
          <span className="font-medium">Chapter Progress</span>
          <span>{completedCount}/{chapters.length} completed</span>
        </div>
        <div className="h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${pct}%`, background: subject.color }}
          />
        </div>
      </div>

      {/* Chapters */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Chapters</h2>
          <button
            onClick={() => setShowChapterForm(true)}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm"
          >
            <Plus className="w-3.5 h-3.5" /> Add Chapter
          </button>
        </div>

        {showChapterForm && (
          <form onSubmit={addChapter} className={clsx(card, 'mb-4 flex gap-3 items-end flex-wrap')}>
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium mb-1">Chapter Title</label>
              <input
                type="text"
                required
                autoFocus
                value={chapterForm.title}
                onChange={e => setChapterForm(f => ({ ...f, title: e.target.value }))}
                className={clsx(
                  'w-full px-3 py-2 rounded-lg border text-sm outline-none focus:ring-2 focus:ring-blue-500',
                  isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
                )}
                placeholder="e.g. Exception Handling"
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Difficulty</label>
              <select
                value={chapterForm.difficulty}
                onChange={e => setChapterForm(f => ({ ...f, difficulty: e.target.value }))}
                className={clsx(
                  'px-3 py-2 rounded-lg border text-sm outline-none',
                  isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
                )}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>
            <div className="flex gap-2">
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm">Add</button>
              <button type="button" onClick={() => setShowChapterForm(false)} className="px-4 py-2 rounded-lg text-sm border border-slate-300 dark:border-slate-600">Cancel</button>
            </div>
          </form>
        )}

        {chapters.length === 0 ? (
          <div className={clsx(card, 'text-center py-10')}>
            <BookOpen className="w-10 h-10 mx-auto mb-2 text-slate-400" />
            <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
              No chapters yet. Add your first chapter to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {chapters.map(ch => {
              const Icon = STATUS_ICONS[ch.status] || Clock
              return (
                <div key={ch.id} className={clsx(
                  card,
                  'flex items-center gap-3'
                )}>
                  <Icon className={clsx('w-4 h-4 shrink-0',
                    ch.status === 'completed' ? 'text-green-500' :
                    ch.status === 'in_progress' ? 'text-blue-500' :
                    ch.status === 'needs_revision' ? 'text-orange-500' : 'text-slate-400'
                  )} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{ch.title}</p>
                    <div className="flex gap-2 mt-1">
                      <span className={clsx('text-xs px-2 py-0.5 rounded-full', STATUS_STYLES[ch.status])}>
                        {ch.status.replace('_', ' ')}
                      </span>
                      <span className={clsx('text-xs', isDark ? 'text-slate-500' : 'text-slate-400')}>
                        {ch.difficulty}
                      </span>
                    </div>
                  </div>
                  <select
                    value={ch.status}
                    onChange={e => updateStatus(ch.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                    className={clsx(
                      'text-xs px-2 py-1 rounded border outline-none',
                      isDark ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-300'
                    )}
                  >
                    <option value="not_started">Not Started</option>
                    <option value="in_progress">In Progress</option>
                    <option value="completed">Completed</option>
                    <option value="needs_revision">Needs Revision</option>
                  </select>
                  <button
                    onClick={() => deleteChapter(ch.id)}
                    className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Documents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Study Materials (PDFs)</h2>
          <label className={clsx(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm cursor-pointer transition-colors',
            uploading
              ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          )}>
            {uploading ? (
              <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
            ) : (
              <Upload className="w-3.5 h-3.5" />
            )}
            {uploading ? 'Uploading…' : 'Upload PDF'}
            <input
              type="file"
              accept=".pdf"
              className="hidden"
              disabled={uploading}
              onChange={handleFileUpload}
            />
          </label>
        </div>

        {documents.length === 0 ? (
          <div className={clsx(card, 'text-center py-8')}>
            <FileText className="w-8 h-8 mx-auto mb-2 text-slate-400" />
            <p className={clsx('text-sm', isDark ? 'text-slate-500' : 'text-slate-400')}>
              Upload a PDF to enable AI Q&A and quiz generation
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className={clsx(
                card,
                'flex items-center gap-3'
              )}>
                <FileText className="w-5 h-5 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{doc.original_name}</p>
                  <p className={clsx('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')}>
                    {doc.page_count ? `${doc.page_count} pages · ` : ''}
                    {doc.chunk_count} chunks ·{' '}
                    <span className={clsx(
                      'font-medium',
                      doc.status === 'ready' ? 'text-green-500' :
                      doc.status === 'processing' ? 'text-yellow-500' :
                      doc.status === 'error' ? 'text-red-500' : 'text-slate-400'
                    )}>
                      {doc.status}
                    </span>
                    {doc.error_message && ` — ${doc.error_message}`}
                  </p>
                </div>
                <button
                  onClick={() => deleteDocument(doc.id)}
                  className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
