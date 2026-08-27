import { useState } from 'react'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import StorePicker from './pages/StorePicker'
import EmployeeDashboard from './pages/EmployeeDashboard'
import DashboardShell from './layouts/DashboardShell'
import type { AuthUser } from './types/auth'
import type { StoreSummary } from './types/store'
import { setAuthToken, clearAuthToken } from './utils/authStorage'
import { logout } from './api/auth'

type View = 'login' | 'forgot-password'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [view, setView] = useState<View>('login')
  const [activeStore, setActiveStore] = useState<StoreSummary | null>(null)
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleLogout() {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
    } catch {
      // local logout must proceed regardless of backend outcome
    } finally {
      clearAuthToken()
      setUser(null)
      setActiveStore(null)
      setView('login')
      setLoggingOut(false)
    }
  }

  function handleLoginSuccess(authUser: AuthUser) {
    setAuthToken(authUser.token)
    setUser(authUser)
  }

  if (!user) {
    return view === 'forgot-password' ? (
      <ForgotPassword onBackToSignIn={() => setView('login')} />
    ) : (
      <Login onLoginSuccess={handleLoginSuccess} onForgotPassword={() => setView('forgot-password')} />
    )
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

  return <EmployeeDashboard user={user} store={activeStore} onLogout={handleLogout} loggingOut={loggingOut} />
}

export default App;
