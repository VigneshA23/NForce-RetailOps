import { useMemo, useState } from 'react'
import { CalendarCheck, History as HistoryIcon, Store as StoreIcon } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import { getInitials } from '../utils/initials'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useNotifications } from '../hooks/useNotifications'
import AppShell from './AppShell'
import EmployeeDashboard from '../pages/EmployeeDashboard'
import EmployeeHistory from '../pages/EmployeeHistory'
import Notifications from '../pages/Notifications'
import Profile from '../pages/Profile'
import Help from '../pages/Help'

interface EmployeeShellProps {
  user: AuthUser
  store: StoreSummary
  stores: StoreSummary[]
  onLogout: () => void
  onSwitchStore: () => void
  loggingOut?: boolean
  avatarUrl?: string | null
  onAvatarChange?: (url: string | null) => void
  employeeId?: number | null
}

const NAV_ITEMS: EmployeeNavItem[] = [
  { key: 'today', label: 'Today', icon: CalendarCheck },
  { key: 'history', label: 'Audit History', icon: HistoryIcon },
]

type Overlay = 'profile' | 'help' | 'notifications' | null

function EmployeeShell({ user, store, stores, onLogout, onSwitchStore, loggingOut, avatarUrl, onAvatarChange, employeeId = null }: EmployeeShellProps) {
  const [activeTab, setActiveTab] = useState<EmployeeNavTabKey>('today')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const isMobile = useIsMobile()
  // With a single assigned store there is nothing to switch to -- the control
  // would only lead to a one-option picker and straight back here.
  const canSwitchStore = stores.length > 1

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName])

  const notificationsState = useNotifications(true)

  function renderActivePage() {
    switch (activeTab) {
      case 'today':
        return <EmployeeDashboard store={store} onLogout={onLogout} loggingOut={false} employeeId={employeeId} />
      case 'history':
        return <EmployeeHistory store={store} stores={stores} />
      default: {
        const _exhaustive: never = activeTab
        return _exhaustive
      }
    }
  }

  // Whichever screen is active -- the currently selected store day-to-day,
  // or a contextual label while on the Profile/Help/Notifications overlays.
  const contextLabel =
    overlay === 'profile'
      ? 'My Profile'
      : overlay === 'help'
        ? 'Help & Guidance'
        : overlay === 'notifications'
          ? 'Notifications'
          : store.name

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
      onNotificationsClick={() => setOverlay('notifications')}
      notificationCount={notificationsState.unreadCount}
      avatarUrl={avatarUrl}
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
        <Profile initials={userInitials} avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} />
      ) : overlay === 'help' ? (
        <Help />
      ) : overlay === 'notifications' ? (
        <Notifications
          notifications={notificationsState.notifications}
          isLoading={notificationsState.isLoading}
          error={notificationsState.error}
          onRetry={notificationsState.reload}
          onMarkRead={notificationsState.markRead}
          onMarkAllRead={notificationsState.markAllRead}
        />
      ) : (
        renderActivePage()
      )}
    </AppShell>
  )
}

export default EmployeeShell
