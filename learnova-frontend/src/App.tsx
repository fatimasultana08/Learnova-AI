import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ThemeProvider, useTheme } from './context/ThemeContext'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import clsx from 'clsx'

// Pages (lazy-ish — simple imports for reliability)
import Dashboard from './pages/Dashboard'
import Subjects from './pages/Subjects'
import SubjectDetail from './pages/SubjectDetail'
import AIAssistant from './pages/AIAssistant'
import Notes from './pages/Notes'
import Quizzes from './pages/Quizzes'
import QuizTake from './pages/QuizTake'
import Courses from './pages/Courses'
import CalendarPage from './pages/CalendarPage'
import Planner from './pages/Planner'
import FocusTimer from './pages/FocusTimer'
import Analytics from './pages/Analytics'
import NotificationsPage from './pages/NotificationsPage'
import SettingsPage from './pages/SettingsPage'

function AppShell() {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className={clsx(
      'flex h-screen overflow-hidden',
      isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'
    )}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <Topbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/subjects" element={<Subjects />} />
            <Route path="/subjects/:id" element={<SubjectDetail />} />
            <Route path="/ai" element={<AIAssistant />} />
            <Route path="/notes" element={<Notes />} />
            <Route path="/quizzes" element={<Quizzes />} />
            <Route path="/quizzes/:id/take" element={<QuizTake />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/timer" element={<FocusTimer />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" />
    </div>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </ThemeProvider>
  )
}
