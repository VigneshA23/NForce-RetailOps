import { Store as StoreIcon } from 'lucide-react'
import type { StoreSummary } from '../types/store'
import type { AuthUser } from '../types/auth'
import ProfileMenu from '../components/ProfileMenu'
import './StorePicker.css'

interface StorePickerProps {
  user: AuthUser
  // Loaded once in App from the server-scoped list, so the picker can never
  // offer a store the employee is not assigned to.
  stores: StoreSummary[]
  onSelectStore: (store: StoreSummary) => void
  onLogout: () => void
  loggingOut?: boolean
}

function StorePicker({ user, stores, onSelectStore, onLogout, loggingOut }: StorePickerProps) {
  return (
    <div className="store-picker">
      <div className="store-picker-topbar">
        <div className="store-picker-brand">
          <img src="/nforce-logo.png" alt="NForce logo" className="store-picker-brand-logo" />
          <div>
            <div className="store-picker-brand-title">NForce RetailOps</div>
            <div className="store-picker-brand-subtitle">Retail Store Operations Platform</div>
          </div>
        </div>
        <ProfileMenu fullName={user.fullName} onLogout={onLogout} loggingOut={loggingOut} />
      </div>

      <div className="store-picker-body">
        <h1 className="store-picker-heading">Select your store</h1>
        <p className="store-picker-subheading">Choose an active location to access the RetailOps dashboard.</p>

        <div className="store-picker-grid">
          {stores.map((store) => {
            const isOpen = store.status === 'Open'
            return (
              <button
                key={store.id}
                type="button"
                className="store-card"
                disabled={!isOpen}
                onClick={() => isOpen && onSelectStore(store)}
              >
                <span className="store-card-icon">
                  <StoreIcon size={20} />
                </span>
                <span className="store-card-name">{store.name}</span>
                {store.location && <span className="store-card-location">{store.location}</span>}
                <span className={`store-card-status store-card-status--${store.status.toLowerCase()}`}>
                  {store.status}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default StorePicker
