import { useState } from 'react'
import Login from './pages/Login'
import ForgotPassword from './pages/ForgotPassword'
import EmployeeDashboard from './pages/EmployeeDashboard'
import OwnerAdminDashboard from './pages/OwnerAdminDashboard'
import type { AuthUser } from './types/auth'

type View = 'login' | 'forgot-password'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [view, setView] = useState<View>('login')

  if (!user) {
    return view === 'forgot-password' ? (
      <ForgotPassword onBackToSignIn={() => setView('login')} />
    ) : (
      <Login onLoginSuccess={setUser} onForgotPassword={() => setView('forgot-password')} />
    )
  }

  return user.role === 'OWNER_ADMIN' ? (
    <OwnerAdminDashboard user={user} />
  ) : (
    <EmployeeDashboard user={user} />
  )
}

export default App
