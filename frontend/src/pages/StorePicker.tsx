import { useEffect, useState } from 'react'
import { Store as StoreIcon } from 'lucide-react'
import { getAuthorizedStores } from '../api/stores'
import type { StoreSummary } from '../types/store'
import type { AuthUser } from '../types/auth'
import ProfileMenu from '../components/ProfileMenu'
import './StorePicker.css'

interface StorePickerProps {
  user: AuthUser
  onSelectStore: (store: StoreSummary) => void
  onLogout: () => void
  loggingOut?: boolean
}

function StorePicker({ user, onSelectStore, onLogout, loggingOut }: StorePickerProps) {
  const [stores, setStores] = useState<StoreSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(null)
    getAuthorizedStores()
      .then((result) => {
        if (active) {
          setStores(result)
        }
      })
      .catch((error: Error) => {
        if (active) {
          setLoadError(error.message)
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [retryToken])

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

        {!loading && loadError && (
          <div className="store-picker-error">
            {loadError}
            <button type="button" className="btn btn--secondary" onClick={() => setRetryToken((token) => token + 1)}>
              Retry
            </button>
          </div>
        )}

        {!loading && !loadError && (
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
                  <span className={`store-card-status store-card-status--${store.status.toLowerCase()}`}>
                    {store.status}
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default StorePicker
