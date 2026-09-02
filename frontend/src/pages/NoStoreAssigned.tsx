import { StoreIcon } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import ProfileMenu from '../components/ProfileMenu'
import './StorePicker.css'

interface NoStoreAssignedProps {
  user: AuthUser
  onLogout: () => void
  loggingOut?: boolean
}

/**
 * Store assignment is optional when an employee is created, so an employee can
 * legitimately sign in with nothing to open yet. Say so plainly instead of
 * showing an empty picker.
 */
function NoStoreAssigned({ user, onLogout, loggingOut }: NoStoreAssignedProps) {
  return (
    <div className="store-picker">
      <div className="store-picker-topbar">
        <div className="store-picker-brand">
          <img src="/nforce-logo.png" alt="NForce logo" className="store-picker-brand-logo" />
          <div>
            <div className="store-picker-brand-title">NForce RetailOps</div>
            <div className="store-picker-brand-subtitle">Store Ops Platform</div>
          </div>
        </div>
        <ProfileMenu fullName={user.fullName} onLogout={onLogout} loggingOut={loggingOut} />
      </div>

      <div className="store-picker-body">
        <span className="store-picker-empty-icon">
          <StoreIcon size={28} />
        </span>
        <h1 className="store-picker-heading">No store assigned yet</h1>
        <p className="store-picker-subheading">
          Ask your manager to assign you to a store, then sign in again.
        </p>
        <button type="button" className="btn btn--secondary" onClick={onLogout} disabled={loggingOut}>
          {loggingOut ? 'Logging out...' : 'Log out'}
        </button>
      </div>
    </div>
  )
}

export default NoStoreAssigned
