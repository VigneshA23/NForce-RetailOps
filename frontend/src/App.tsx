import { useCallback, useEffect, useState } from 'react'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import ResetPasswordRequired from './pages/ResetPasswordRequired'
import StorePicker from './pages/StorePicker'
import EmployeeShell from './layouts/EmployeeShell'
import DashboardShell from './layouts/DashboardShell'
import SuperAdminDashboard from './pages/SuperAdminDashboard'
import type { AuthUser } from './types/auth'
import type { StoreSummary } from './types/store'
import NoStoreAssigned from './pages/NoStoreAssigned'
import {
  AUTH_TOKEN_STORAGE_KEY,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  getActiveStoreId,
  setActiveStoreId,
  clearActiveStoreId,
} from './utils/authStorage'
import { DEFAULT_INACTIVITY_TIMEOUT_MINUTES, onUnauthorizedResponse, startInactivityTimer } from './utils/sessionManager'
import { getSessionConfig, logout } from './api/auth'
import { getMe } from './api/me'
import { useAssignedStores } from './hooks/useAssignedStores'

type View = 'login' | 'forgot-password'

const INACTIVITY_MESSAGE = 'Your session has expired due to inactivity. Please log in again.'
const INVALID_SESSION_MESSAGE = 'Your session has expired or is invalid. Please log in again.'
const SIGNED_OUT_ELSEWHERE_MESSAGE = 'You have been logged out.'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false)
  const [view, setView] = useState<View>('login')
  const [activeStore, setActiveStore] = useState<StoreSummary | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)
  // Starts true whenever a token is already in storage: we must not flash the
  // Login screen while we are still finding out whether that token is good.
  const [restoringSession, setRestoringSession] = useState(() => getAuthToken() !== null)

  const isEmployee = user?.role === 'EMPLOYEE'
  const {
    stores,
    isLoading: storesLoading,
    error: storesError,
    reload: reloadStores,
  } = useAssignedStores(Boolean(isEmployee))

  // The one place that ends an authenticated session, for any reason: manual
  // logout, inactivity timeout, or a 401 from any API call. Every protected
  // page renders conditionally on `user`, so clearing it here is sufficient
  // to fall back to Login from anywhere in the app.
  const endSession = useCallback((message: string | null) => {
    clearAuthToken()
    clearActiveStoreId()
    setUser(null)
    setNeedsPasswordReset(false)
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

<<<<<<< HEAD
  function handleLoginSuccess(authUser: AuthUser, remember: boolean) {
    setAuthToken(authUser.token, remember)
=======
<<<<<<< Updated upstream
  function handleLoginSuccess(authUser: AuthUser) {
    setAuthToken(authUser.token)
=======
  function handleLoginSuccess(authUser: AuthUser, remember: boolean, mustResetPassword: boolean) {
    setAuthToken(authUser.token, remember)
>>>>>>> Stashed changes
>>>>>>> Maheshwar/dev-work
    setSessionMessage(null)
    setUser(authUser)
    setNeedsPasswordReset(mustResetPassword)
  }

  // Rehydrate the session on boot. The token outlives a page load, so ask the
  // server who it belongs to rather than trusting anything cached locally; a
  // token that is expired, revoked, or belongs to a deactivated account fails
  // here and is cleared.
  useEffect(() => {
    if (!restoringSession) return

    const token = getAuthToken()
    if (!token) {
      setRestoringSession(false)
      return
    }

    let active = true
    getMe()
      .then((me) => {
        if (!active) return
        setUser({ token, role: me.role, fullName: me.fullName })
        setNeedsPasswordReset(me.mustResetPassword)
      })
      .catch(() => {
        if (!active) return
        clearAuthToken()
        clearActiveStoreId()
      })
      .finally(() => {
        if (active) setRestoringSession(false)
      })

    return () => {
      active = false
    }
  }, [restoringSession])

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

  // Store bootstrap. The server's list is the only source of truth for what an
  // employee may open: one store selects itself, and a remembered choice is
  // honoured only if that store is still in the list.
  useEffect(() => {
    if (!isEmployee || storesLoading || storesError) return

    setActiveStore((current) => {
      if (current && stores.some((store) => store.id === current.id)) return current
      if (stores.length === 1) return stores[0]
      const rememberedId = getActiveStoreId()
      return stores.find((store) => store.id === rememberedId) ?? null
    })
  }, [isEmployee, stores, storesLoading, storesError])

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

  if (restoringSession) {
    return <div className="app-boot">Loading...</div>
  }

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

  if (needsPasswordReset) {
    return (
      <ResetPasswordRequired
        onSuccess={() => setNeedsPasswordReset(false)}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    )
  }

  if (user.role === 'SUPER_ADMIN') {
    return <SuperAdminDashboard user={user} onLogout={handleLogout} loggingOut={loggingOut} />
  }

  if (user.role === 'OWNER_ADMIN') {
    return <DashboardShell user={user} onLogout={handleLogout} loggingOut={loggingOut} />
  }

  if (storesLoading) {
    return <div className="app-boot">Loading your stores...</div>
  }

  if (storesError) {
    return (
      <div className="app-boot app-boot--error">
        {storesError}
        <button type="button" className="btn btn--secondary" onClick={reloadStores}>
          Retry
        </button>
      </div>
    )
  }

  if (stores.length === 0) {
    return <NoStoreAssigned user={user} onLogout={handleLogout} loggingOut={loggingOut} />
  }

  if (!activeStore) {
    return (
      <StorePicker
        user={user}
        stores={stores}
        onSelectStore={(store) => {
          setActiveStoreId(store.id)
          setActiveStore(store)
        }}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    )
  }

  return (
    <EmployeeShell
      user={user}
      store={activeStore}
      stores={stores}
      onLogout={handleLogout}
      onSwitchStore={() => {
        clearActiveStoreId()
        setActiveStore(null)
      }}
      loggingOut={loggingOut}
    />
  )
}

export default App
