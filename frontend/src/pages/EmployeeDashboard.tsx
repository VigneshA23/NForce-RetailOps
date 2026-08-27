import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import ProfileMenu from '../components/ProfileMenu'
import './EmployeeDashboard.css'

interface EmployeeDashboardProps {
  user: AuthUser
  store: StoreSummary
  onLogout: () => void
  loggingOut?: boolean
}

function EmployeeDashboard({ user, store, onLogout, loggingOut }: EmployeeDashboardProps) {
  return (
    <div className="employee-dashboard">
      <header className="employee-dashboard__header">
        <div>
          <span className="employee-dashboard__store">{store.name}</span>
        </div>
        <ProfileMenu fullName={user.fullName} onLogout={onLogout} loggingOut={loggingOut} />
      </header>
      <main className="employee-dashboard__main">
        <h1>Welcome, {user.fullName}</h1>
        <p>
          Employee daily checklist for <strong>{store.name}</strong> goes here.
        </p>
      </main>
    </div>
  )
}

export default EmployeeDashboard
