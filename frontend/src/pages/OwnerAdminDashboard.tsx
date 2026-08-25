import type { AuthUser } from '../types/auth'

interface OwnerAdminDashboardProps {
  user: AuthUser
}

function OwnerAdminDashboard({ user }: OwnerAdminDashboardProps) {
  return (
    <div style={{ padding: 32 }}>
      <h1>Welcome, {user.fullName}</h1>
      <p>Owner/Admin dashboard goes here.</p>
    </div>
  )
}

export default OwnerAdminDashboard
