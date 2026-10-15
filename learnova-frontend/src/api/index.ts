import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
})

export default api

// ─── Subjects ────────────────────────────────────────────────────────────────

export const subjectsApi = {
  list: (archived = false) => api.get(`/subjects?archived=${archived}`),
  get: (id: number) => api.get(`/subjects/${id}`),
  create: (data: any) => api.post('/subjects', data),
  update: (id: number, data: any) => api.put(`/subjects/${id}`, data),
  delete: (id: number) => api.delete(`/subjects/${id}`),
}

// ─── Chapters ────────────────────────────────────────────────────────────────

export const chaptersApi = {
  list: (subjectId: number) => api.get(`/chapters/subject/${subjectId}`),
  get: (id: number) => api.get(`/chapters/${id}`),
  create: (data: any) => api.post('/chapters', data),
  update: (id: number, data: any) => api.put(`/chapters/${id}`, data),
  delete: (id: number) => api.delete(`/chapters/${id}`),
  reorder: (orders: any[]) => api.post('/chapters/reorder', orders),
}

// ─── Documents ───────────────────────────────────────────────────────────────

export const documentsApi = {
  list: (subjectId: number) => api.get(`/documents/subject/${subjectId}`),
  get: (id: number) => api.get(`/documents/${id}`),
  upload: (formData: FormData) =>
    api.post('/documents', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  delete: (id: number) => api.delete(`/documents/${id}`),
}

// ─── AI ──────────────────────────────────────────────────────────────────────

export const aiApi = {
  chat: (data: any) => api.post('/ai/chat', data),
  history: (sessionId: string) => api.get(`/ai/chat/history/${sessionId}`),
  providerStatus: () => api.get('/ai/provider/status'),
  generateNotes: (chapterId: number, documentIds?: number[]) =>
    api.post('/ai/generate-notes', null, {
      params: { chapter_id: chapterId, document_ids: documentIds?.join(',') },
    }),
}

// ─── Quizzes ─────────────────────────────────────────────────────────────────

export const quizzesApi = {
  list: (subjectId?: number) => api.get('/quizzes', { params: { subject_id: subjectId } }),
  get: (id: number) => api.get(`/quizzes/${id}`),
  create: (data: any) => api.post('/quizzes', data),
  delete: (id: number) => api.delete(`/quizzes/${id}`),
  submitAttempt: (quizId: number, data: any) => api.post(`/quizzes/${quizId}/attempts`, data),
  attempts: (quizId: number) => api.get(`/quizzes/${quizId}/attempts`),
  flagQuestion: (questionId: number) => api.post(`/quizzes/questions/${questionId}/flag`),
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

export const calendarApi = {
  list: (start?: string, end?: string) => api.get('/events', { params: { start, end } }),
  get: (id: number) => api.get(`/events/${id}`),
  create: (data: any) => api.post('/events', data),
  update: (id: number, data: any) => api.put(`/events/${id}`, data),
  delete: (id: number) => api.delete(`/events/${id}`),
}

// ─── Tasks ───────────────────────────────────────────────────────────────────

export const tasksApi = {
  list: (params?: any) => api.get('/tasks', { params }),
  get: (id: number) => api.get(`/tasks/${id}`),
  create: (data: any) => api.post('/tasks', data),
  update: (id: number, data: any) => api.put(`/tasks/${id}`, data),
  delete: (id: number) => api.delete(`/tasks/${id}`),
  generatePlan: (daysAhead?: number, dailyHours?: number) =>
    api.post('/tasks/generate-plan', null, {
      params: { days_ahead: daysAhead, daily_hours: dailyHours },
    }),
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export const sessionsApi = {
  list: (params?: any) => api.get('/sessions', { params }),
  create: (data: any) => api.post('/sessions', data),
  update: (id: number, data: any) => api.put(`/sessions/${id}`, data),
  delete: (id: number) => api.delete(`/sessions/${id}`),
  summary: () => api.get('/sessions/analytics/summary'),
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export const analyticsApi = {
  dashboard: () => api.get('/analytics/dashboard'),
}

// ─── Notifications ────────────────────────────────────────────────────────────

export const notificationsApi = {
  list: (unreadOnly?: boolean) => api.get('/notifications', { params: { unread_only: unreadOnly } }),
  markRead: (id: number) => api.post(`/notifications/${id}/read`),
  markAllRead: () => api.post('/notifications/read-all'),
  delete: (id: number) => api.delete(`/notifications/${id}`),
  refreshWarnings: () => api.post('/notifications/refresh-warnings'),
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export const settingsApi = {
  get: () => api.get('/settings'),
  update: (data: any) => api.put('/settings', data),
}

// ─── Courses ──────────────────────────────────────────────────────────────────

export const coursesApi = {
  list: () => api.get('/courses'),
  get: (id: number) => api.get(`/courses/${id}`),
  create: (data: any) => api.post('/courses', data),
  delete: (id: number) => api.delete(`/courses/${id}`),
  addModule: (data: any) => api.post('/courses/modules', data),
  addLesson: (data: any) => api.post('/courses/lessons', data),
  updateLesson: (id: number, status: string) =>
    api.put(`/courses/lessons/${id}`, null, { params: { status } }),
}

// ─── ML ──────────────────────────────────────────────────────────────────────

export const mlApi = {
  train: () => api.post('/ml/train'),
  predict: (chapterId: number) => api.get(`/ml/predict/${chapterId}`),
  predictAll: () => api.get('/ml/predict-all'),
}
