import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'

interface EmployeeDashboardProps {
  user: AuthUser
  store: StoreSummary
}

function EmployeeDashboard({ user, store }: EmployeeDashboardProps) {
  return (
    <div style={{ padding: 32 }}>
      <h1>Welcome, {user.fullName}</h1>
      <p>
        Employee daily checklist for <strong>{store.name}</strong> goes here.
      </p>
    </div>
  )
}

export default EmployeeDashboard
