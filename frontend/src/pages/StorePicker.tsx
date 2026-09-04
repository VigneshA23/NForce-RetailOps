import { useEffect, useState } from 'react'
import { Store as StoreIcon } from 'lucide-react'
import type { StoreSummary } from '../types/store'
import type { AuthUser } from '../types/auth'
import Header from '../components/Header'
import { useTheme } from '../hooks/useTheme'
import './StorePicker.css'

// Cycled by position so a multi-store grid reads as a set of distinct
// places rather than identical tiles repeated -- purely decorative, no
// meaning tied to a particular store.
const CARD_TONES = ['primary', 'info', 'success', 'purple', 'warning'] as const

interface StorePickerProps {
  user: AuthUser
  // Server-scoped list, so the picker can never offer a store the employee
  // is not assigned to -- but the list itself is only as fresh as the last
  // fetch. onReload re-fetches it every time this screen is actually shown
  // (first login, or returning via "Switch Store"), so a store an Admin
  // unassigned the employee from mid-session doesn't linger as a stale card.
  stores: StoreSummary[]
  onSelectStore: (store: StoreSummary) => void
  onReload: () => void
  onLogout: () => void
  loggingOut?: boolean
}

function StorePicker({ user, stores, onSelectStore, onReload, onLogout, loggingOut }: StorePickerProps) {
  const { isDarkTheme, toggleTheme } = useTheme()
  const [searchValue, setSearchValue] = useState('')

  useEffect(() => {
    onReload()
    // Only ever re-run if the callback identity itself changes, not on every
    // render -- this must fire once per mount (each time the picker is shown).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="store-picker">
      <Header
        title="NForce RetailOps"
        subtitle="Choose a Store"
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
        <h1 className="store-picker-heading">Select your store</h1>
        <p className="store-picker-subheading">Choose an active location to access the RetailOps dashboard.</p>

        <div className="store-picker-grid">
          {stores.map((store, index) => {
            const isOpen = store.status === 'Open'
            const tone = CARD_TONES[index % CARD_TONES.length]
            return (
              <button
                key={store.id}
                type="button"
                className={`store-card store-card--${tone}`}
                disabled={!isOpen}
                data-initial={store.name.charAt(0).toUpperCase()}
                style={{ animationDelay: `${index * 150}ms` }}
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
