import { useMemo, useState } from 'react'
import { CalendarCheck, History as HistoryIcon, Inbox, Store as StoreIcon } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import { getInitials } from '../utils/initials'
import AppShell from './AppShell'
import EmployeeDashboard from '../pages/EmployeeDashboard'
import EmployeeHistory from '../pages/EmployeeHistory'
import PlaceholderPage from '../components/PlaceholderPage'
import Profile from '../pages/Profile'
import Help from '../pages/Help'

interface EmployeeShellProps {
  user: AuthUser
  store: StoreSummary
  stores: StoreSummary[]
  onLogout: () => void
  onSwitchStore: () => void
  loggingOut?: boolean
}

const NAV_ITEMS: EmployeeNavItem[] = [
  { key: 'today', label: 'Today', icon: CalendarCheck },
  { key: 'history', label: 'History', icon: HistoryIcon },
  { key: 'audits', label: 'Audits & Inbox', icon: Inbox },
]

type Overlay = 'profile' | 'help' | null

function EmployeeShell({ user, store, stores, onLogout, onSwitchStore, loggingOut }: EmployeeShellProps) {
  const [activeTab, setActiveTab] = useState<EmployeeNavTabKey>('today')
  const [overlay, setOverlay] = useState<Overlay>(null)
  // With a single assigned store there is nothing to switch to -- the control
  // would only lead to a one-option picker and straight back here.
  const canSwitchStore = stores.length > 1

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName])

  function renderActivePage() {
    switch (activeTab) {
      case 'today':
        return <EmployeeDashboard store={store} onLogout={onLogout} loggingOut={false} />
      case 'history':
        return <EmployeeHistory store={store} stores={stores} />
      case 'audits':
        return <PlaceholderPage title="Audits & Inbox" icon={Inbox} />
      default: {
        const _exhaustive: never = activeTab
        return _exhaustive
      }
    }
  }

  // The app name stays fixed in the header; the second line reflects
  // whichever screen is active -- the currently selected store day-to-day,
  // or a contextual label while on the Profile/Help overlays.
  const subtitle = overlay === 'profile' ? 'My Profile' : overlay === 'help' ? 'Help & Guidance' : store.name

  return (
    <AppShell<EmployeeNavTabKey>
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onSelectTab={(key) => {
        setOverlay(null)
        setActiveTab(key)
      }}
      title="NForce RetailOps"
      subtitle={subtitle}
      logoSrc="/nforce-logo.png"
      user={user}
      onLogout={onLogout}
      loggingOut={loggingOut}
      onProfileClick={() => setOverlay('profile')}
      onHelpClick={() => setOverlay('help')}
      mobileNav="bottom-tabs"
      headerActions={
        canSwitchStore && (
          <button
            type="button"
            className="btn btn--secondary switch-store-btn"
            onClick={onSwitchStore}
            aria-label="Switch Store"
          >
            <StoreIcon size={16} />
            <span className="switch-store-btn__label">Switch Store</span>
          </button>
        )
      }
    >
      {overlay === 'profile' ? <Profile initials={userInitials} /> : overlay === 'help' ? <Help /> : renderActivePage()}
    </AppShell>
  )
}

export default EmployeeShell
