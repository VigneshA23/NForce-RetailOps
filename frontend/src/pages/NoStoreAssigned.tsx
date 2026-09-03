import { useState } from 'react'
import { StoreIcon } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import Header from '../components/Header'
import { useTheme } from '../hooks/useTheme'
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
  const { isDarkTheme, toggleTheme } = useTheme()
  const [searchValue, setSearchValue] = useState('')

  return (
    <div className="store-picker">
      <Header
        title="NForce RetailOps"
        subtitle="Store Ops Platform"
        logoSrc="/nforce-logo.png"
        showSearch={false}
        showNotifications={false}
        centeredModals
        searchValue={searchValue}
        onSearchChange={setSearchValue}
        isDarkTheme={isDarkTheme}
        onToggleTheme={toggleTheme}
        userName={user.fullName}
        onLogout={onLogout}
        loggingOut={loggingOut}
      />

      <div className="store-picker-body">
        <div className="store-picker-empty-card">
          <span className="store-picker-empty-icon">
            <StoreIcon size={28} />
          </span>
          <h1 className="store-picker-heading">No store assigned yet</h1>
          <p className="store-picker-subheading">
            Ask your manager to assign you to a store, then sign in again.
          </p>
          <button
            type="button"
            className="btn btn--secondary store-picker-empty-logout"
            onClick={onLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Logging out...' : 'Log out'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NoStoreAssigned
