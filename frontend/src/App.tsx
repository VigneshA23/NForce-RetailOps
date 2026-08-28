import { useCallback, useEffect, useState } from 'react'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import StorePicker from './pages/StorePicker'
import EmployeeShell from './layouts/EmployeeShell'
import DashboardShell from './layouts/DashboardShell'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import type { AuthUser } from './types/auth'
import type { StoreSummary } from './types/store'
import { AUTH_TOKEN_STORAGE_KEY, setAuthToken, clearAuthToken } from './utils/authStorage'
import { DEFAULT_INACTIVITY_TIMEOUT_MINUTES, onUnauthorizedResponse, startInactivityTimer } from './utils/sessionManager'
import { getSessionConfig, logout } from './api/auth'

type View = 'login' | 'forgot-password'

const INACTIVITY_MESSAGE = 'Your session has expired due to inactivity. Please log in again.'
const INVALID_SESSION_MESSAGE = 'Your session has expired or is invalid. Please log in again.'
const SIGNED_OUT_ELSEWHERE_MESSAGE = 'You have been logged out.'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [view, setView] = useState<View>('login')
  const [activeStore, setActiveStore] = useState<StoreSummary | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)

  // The one place that ends an authenticated session, for any reason: manual
  // logout, inactivity timeout, or a 401 from any API call. Every protected
  // page renders conditionally on `user`, so clearing it here is sufficient
  // to fall back to Login from anywhere in the app.
  const endSession = useCallback((message: string | null) => {
    clearAuthToken()
    setUser(null)
    setActiveStore(null)
    setView('login')
    setSessionMessage(message)
  }, [])

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      // local logout must proceed regardless of backend outcome
    } finally {
      setLoggingOut(false)
      endSession(null) // manual logout never shows a session-expiration notice
    }
  }

  function handleLoginSuccess(authUser: AuthUser) {
    setAuthToken(authUser.token)
    setSessionMessage(null)
    setUser(authUser)
  }

  // Single global session-management mechanism: an inactivity timer plus a
  // 401 watcher, both scoped to the lifetime of an authenticated session.
  // No page or shell owns any of this logic individually.
  useEffect(() => {
    if (!user) return

    let disposed = false
    let stopTimer = startInactivityTimer(
      DEFAULT_INACTIVITY_TIMEOUT_MINUTES * 60_000,
      () => endSession(INACTIVITY_MESSAGE),
    )

    getSessionConfig()
      .then((config) => {
        if (disposed) return
        stopTimer()
        stopTimer = startInactivityTimer(
          config.inactivityTimeoutMinutes * 60_000,
          () => endSession(INACTIVITY_MESSAGE),
        )
      })
      .catch(() => {
        // Keep running with the default timeout if the config can't be fetched.
      })

    const stopUnauthorizedWatch = onUnauthorizedResponse(() => endSession(INVALID_SESSION_MESSAGE))

    return () => {
      disposed = true
      stopTimer()
      stopUnauthorizedWatch()
    }
  }, [user, endSession])

  // Cross-tab sync: another tab clearing the shared auth token (logout or
  // expiration there) ends this tab's session too.
  useEffect(() => {
    function handleStorageChange(event: StorageEvent) {
      if (event.key === AUTH_TOKEN_STORAGE_KEY && event.newValue === null && user) {
        endSession(SIGNED_OUT_ELSEWHERE_MESSAGE)
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [user, endSession])

  if (!user) {
    return view === 'forgot-password' ? (
      <ForgotPassword onBackToSignIn={() => setView('login')} />
    ) : (
      <Login
        onLoginSuccess={handleLoginSuccess}
        onForgotPassword={() => setView('forgot-password')}
        notice={sessionMessage}
      />
    )
  }

  if (user.role === 'SUPER_ADMIN') {
    return <SuperAdminDashboard user={user} onLogout={handleLogout} loggingOut={loggingOut} />
  }

  if (user.role === 'OWNER_ADMIN') {
    return <DashboardShell user={user} onLogout={handleLogout} loggingOut={loggingOut} />
  }

  if (!activeStore) {
    return (
      <StorePicker
        user={user}
        onSelectStore={setActiveStore}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    )
  }

  return (
    <EmployeeShell
      user={user}
      store={activeStore}
      onLogout={handleLogout}
      onSwitchStore={() => setActiveStore(null)}
    />
  )
}

export default App
