import { useMemo, useState } from 'react'
import { CalendarCheck, History as HistoryIcon, Inbox, Store as StoreIcon } from 'lucide-react'
import type { MeResponse } from '../api/me'
import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import { getInitials } from '../utils/initials'
import { useIsMobile } from '../hooks/useMediaQuery'
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
  me: MeResponse | null
  meLoading: boolean
  meError: string | null
  onMeUpdated: (me: MeResponse) => void
}

const NAV_ITEMS: EmployeeNavItem[] = [
  { key: 'today', label: 'Today', icon: CalendarCheck },
  { key: 'history', label: 'History', icon: HistoryIcon },
  { key: 'audits', label: 'Audits & Inbox', icon: Inbox },
]

type Overlay = 'profile' | 'help' | null

function EmployeeShell({
  user, store, stores, onLogout, onSwitchStore, loggingOut, me, meLoading, meError, onMeUpdated,
}: EmployeeShellProps) {
  const [activeTab, setActiveTab] = useState<EmployeeNavTabKey>('today')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const isMobile = useIsMobile()
  // With a single assigned store there is nothing to switch to -- the control
  // would only lead to a one-option picker and straight back here.
  const canSwitchStore = stores.length > 1

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName])

  function renderActivePage() {
    switch (activeTab) {
      case 'today':
        return <EmployeeDashboard store={store} onLogout={onLogout} loggingOut={false} employeeId={me?.id ?? null} />
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

  // Whichever screen is active -- the currently selected store day-to-day,
  // or a contextual label while on the Profile/Help overlays.
  const contextLabel = overlay === 'profile' ? 'My Profile' : overlay === 'help' ? 'Help & Guidance' : store.name

  // On mobile there's no sidebar, so the header is the only place the app is
  // ever named -- it keeps the full "NForce RetailOps" title with the context
  // as a subtitle. On desktop/tablet the sidebar already carries that
  // branding, so the header collapses to just the context label instead of
  // repeating "NForce RetailOps" a second time.
  const headerTitle = isMobile ? 'NForce RetailOps' : contextLabel
  const headerSubtitle = isMobile ? contextLabel : undefined

  return (
    <AppShell<EmployeeNavTabKey>
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      onSelectTab={(key) => {
        setOverlay(null)
        setActiveTab(key)
      }}
      title={headerTitle}
      subtitle={headerSubtitle}
      logoSrc="/nforce-logo.png"
      hideLogoOnDesktop
      centeredModals
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
      {overlay === 'profile' ? (
        <Profile
          initials={userInitials}
          me={me}
          isLoading={meLoading}
          error={meError}
          onMeUpdated={onMeUpdated}
          variant="employee"
        />
      ) : overlay === 'help' ? (
        <Help />
      ) : (
        renderActivePage()
      )}
    </AppShell>
  )
}

export default EmployeeShell
