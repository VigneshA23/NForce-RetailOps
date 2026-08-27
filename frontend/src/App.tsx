import { useState } from 'react'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import StorePicker from './pages/StorePicker'
import EmployeeShell from './layouts/EmployeeShell'
import DashboardShell from './layouts/DashboardShell'
import type { AuthUser } from './types/auth'
import type { StoreSummary } from './types/store'
import { setAuthToken, clearAuthToken } from './utils/authStorage'

type View = 'login' | 'forgot-password'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [view, setView] = useState<View>('login')
  const [activeStore, setActiveStore] = useState<StoreSummary | null>(null)

  function handleLogout() {
    clearAuthToken()
    setUser(null)
    setActiveStore(null)
    setView('login')
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
    return <DashboardShell />
  }

  if (!activeStore) {
    return <StorePicker user={user} onSelectStore={setActiveStore} onLogout={handleLogout} />
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

export default App;
