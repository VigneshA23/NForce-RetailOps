import type { AuthUser } from '../types/auth'

interface EmployeeDashboardProps {
  user: AuthUser
}

function EmployeeDashboard({ user }: EmployeeDashboardProps) {
  return (
    <div style={{ padding: 32 }}>
      <h1>Welcome, {user.fullName}</h1>
      <p>Employee daily checklist goes here.</p>
    </div>
  )
}

export default EmployeeDashboard
