import { useCallback, useEffect, useState } from 'react'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import SetNewPassword from './pages/SetNewPassword'
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
  getStoredAvatarUrl,
  setStoredAvatarUrl,
  clearStoredAvatarUrl,
} from './utils/authStorage'
import { DEFAULT_INACTIVITY_TIMEOUT_MINUTES, onUnauthorizedResponse, startInactivityTimer } from './utils/sessionManager'
import { getSessionConfig, logout } from './api/auth'
import { useAssignedStores } from './hooks/useAssignedStores'
import { useMe } from './hooks/useMe'

type View = 'login' | 'forgot-password' | 'set-new-password'

const INACTIVITY_MESSAGE = 'Your session has expired due to inactivity. Please log in again.'
const INVALID_SESSION_MESSAGE = 'Your session has expired or is invalid. Please log in again.'
const SIGNED_OUT_ELSEWHERE_MESSAGE = 'You have been logged out.'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false)
  const [resetToken] = useState<string | null>(() => new URLSearchParams(window.location.search).get('token'))
  const [view, setView] = useState<View>(() =>
    new URLSearchParams(window.location.search).get('token') ? 'set-new-password' : 'login',
  )
  const [activeStore, setActiveStore] = useState<StoreSummary | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [sessionMessage, setSessionMessage] = useState<string | null>(null)
  // Starts true whenever a token is already in storage: we must not flash the
  // Login screen while we are still finding out whether that token is good.
  const [restoringSession, setRestoringSession] = useState(() => getAuthToken() !== null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => getStoredAvatarUrl())

  const isEmployee = user?.role === 'EMPLOYEE'
  const {
    stores,
    isLoading: storesLoading,
    error: storesError,
    reload: reloadStores,
  } = useAssignedStores(Boolean(isEmployee))
  const meState = useMe(restoringSession || (user !== null && user.role !== 'SUPER_ADMIN'))

  // The one place that ends an authenticated session, for any reason: manual
  // logout, inactivity timeout, or a 401 from any API call. Every protected
  // page renders conditionally on `user`, so clearing it here is sufficient
  // to fall back to Login from anywhere in the app.
  const endSession = useCallback((message: string | null) => {
    clearAuthToken()
    clearActiveStoreId()
    clearStoredAvatarUrl()
    setUser(null)
    setNeedsPasswordReset(false)
    setActiveStore(null)
    setAvatarUrl(null)
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

  function handleLoginSuccess(authUser: AuthUser, remember: boolean, mustResetPassword: boolean) {
    setAuthToken(authUser.token, remember)
    setSessionMessage(null)
    setUser(authUser)
    setNeedsPasswordReset(mustResetPassword)
  }

  function handleAvatarChange(url: string | null) {
    setAvatarUrl(url)
    setStoredAvatarUrl(url)
  }

  // Rehydrate the session on boot. The token outlives a page load, so ask the
  // server who it belongs to rather than trusting anything cached locally; a
  // token that is expired, revoked, or belongs to a deactivated account fails
  // here and is cleared.
  useEffect(() => {
    if (!restoringSession || meState.isLoading) return

    const token = getAuthToken()
    if (token && meState.me) {
      setUser({ token, role: meState.me.role, fullName: meState.me.fullName })
      setNeedsPasswordReset(meState.me.mustResetPassword)
      if (meState.me.avatarUrl) {
        setAvatarUrl(meState.me.avatarUrl)
        setStoredAvatarUrl(meState.me.avatarUrl)
      }
    } else {
      clearAuthToken()
      clearActiveStoreId()
    }

    setRestoringSession(false)
  }, [restoringSession, meState.isLoading])

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
    if (view === 'set-new-password' && resetToken) {
      return (
        <SetNewPassword
          token={resetToken}
          onDone={() => {
            window.history.replaceState({}, '', '/')
            setView('login')
          }}
        />
      )
    }
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
    return <DashboardShell user={user} onLogout={handleLogout} loggingOut={loggingOut} avatarUrl={avatarUrl} onAvatarChange={handleAvatarChange} />
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
      avatarUrl={avatarUrl}
      onAvatarChange={handleAvatarChange}
      employeeId={meState.me?.id ?? null}
    />
  )
}

export default App
