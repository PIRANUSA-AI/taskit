import { useLocation, Route, Routes, Navigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { TopChrome } from './components/TopChrome'
import { BottomDock } from './components/BottomDock'
import { InstallBanner } from './components/InstallBanner'
import { ToastProvider } from './components/Toast'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoadingScreen } from './components/LoadingScreen'
import Welcome from './pages/Welcome'
import Login from './pages/Login'
import Home from './pages/Home'
import Riwayat from './pages/Riwayat'
import Tugas from './pages/Tugas'
import Profil from './pages/Profil'
import Job from './pages/Job'
import SharedJob from './pages/SharedJob'
import MyTasks from './pages/MyTasks'
import Admin from './pages/Admin'
import Playground from './pages/Playground'
import SearchPage from './pages/SearchPage'
import NotFound from './pages/NotFound'

function RootPage() {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/welcome" replace />
  return <Home />
}

function AppShell() {
  const { user, loading } = useAuth()
  // Chrome only for authenticated users; public routes render fullscreen.
  const showChrome = !loading && Boolean(user)
  return (
    <>
      {showChrome && <TopChrome />}
      <AnimatedRoutes />
      {showChrome && <BottomDock />}
    </>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        initial={{ opacity: 0, x: 12 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -12 }}
        transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        style={{ minHeight: '100%' }}
      >
        <Routes location={location}>
          <Route path="/" element={<RootPage />} />
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/share/:token" element={<SharedJob />} />
          <Route path="/tasks/:token" element={<MyTasks />} />
          <Route
            path="/riwayat"
            element={
              <ProtectedRoute>
                <Riwayat />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tugas"
            element={
              <ProtectedRoute>
                <Tugas />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profil"
            element={
              <ProtectedRoute>
                <Profil />
              </ProtectedRoute>
            }
          />
          <Route
            path="/job/:id"
            element={
              <ProtectedRoute>
                <Job />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute adminOnly>
                <Admin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/playground"
            element={
              <ProtectedRoute adminOnly>
                <Playground />
              </ProtectedRoute>
            }
          />
          <Route
            path="/search"
            element={
              <ProtectedRoute>
                <SearchPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </motion.div>
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <InstallBanner />
        <AppShell />
      </ToastProvider>
    </AuthProvider>
  )
}
