import { useMemo, useState } from 'react'
import { CalendarCheck, Inbox, Store as StoreIcon } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import { getInitials } from '../utils/initials'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useUnreadCount } from '../hooks/useUnreadCount'
import AppShell from './AppShell'
import EmployeeDashboard from '../pages/EmployeeDashboard'
import EmployeeHistory from '../pages/EmployeeHistory'
import Notifications from '../pages/Notifications'
import PlaceholderPage from '../components/PlaceholderPage'
import Profile from '../pages/Profile'
import Help from '../pages/Help'
import Settings from '../pages/Settings'

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
  { key: 'audits', label: 'Audits & Inbox', icon: Inbox },
]

type Overlay = 'profile' | 'help' | 'history' | 'settings' | 'notifications' | null

function EmployeeShell({ user, store, stores, onLogout, onSwitchStore, loggingOut, avatarUrl, onAvatarChange, employeeId = null }: EmployeeShellProps) {
  const [activeTab, setActiveTab] = useState<EmployeeNavTabKey>('today')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const isMobile = useIsMobile()
  const { count: unreadCount, setCount } = useUnreadCount()
  const canSwitchStore = stores.length > 1

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName])

  function handleNotificationsCountChange(value: number) {
    if (value === 0) setCount(0)
    else setCount((prev) => Math.max(0, prev + value))
  }

  function handleNotificationNavigate(path: string) {
    switch (path) {
      case '/checklist': setActiveTab('today'); setOverlay(null); break
      case '/history': setOverlay('history'); break
      default: setOverlay('notifications'); break
    }
  }

  function renderActivePage() {
    switch (activeTab) {
      case 'today':
        return <EmployeeDashboard store={store} onLogout={onLogout} loggingOut={false} employeeId={employeeId} />
      case 'audits':
        return <PlaceholderPage title="Audits & Inbox" icon={Inbox} />
      default: {
        const _exhaustive: never = activeTab
        return _exhaustive
      }
    }
  }

  const contextLabel = overlay === 'profile' ? 'My Profile'
    : overlay === 'help' ? 'Help & Guidance'
    : overlay === 'history' ? 'History'
    : overlay === 'settings' ? 'Settings'
    : store.name

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
      contentKey={overlay ?? activeTab}
      logoSrc="/nforce-logo.png"
      hideLogoOnDesktop
      centeredModals
      user={user}
      onLogout={onLogout}
      loggingOut={loggingOut}
      onProfileClick={() => setOverlay('profile')}
      onHelpClick={() => setOverlay('help')}
      onHistoryClick={() => setOverlay('history')}
      onSettingsClick={() => setOverlay('settings')}
      onNotificationsClick={() => setOverlay('notifications')}
      onNotificationNavigate={handleNotificationNavigate}
      notificationUnreadCount={unreadCount}
      onNotificationsCountChange={handleNotificationsCountChange}
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
      {overlay === 'profile'
        ? <Profile initials={userInitials} avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} />
        : overlay === 'help'
        ? <Help />
        : overlay === 'history'
        ? <EmployeeHistory store={store} stores={stores} />
        : overlay === 'settings'
        ? <Settings />
        : overlay === 'notifications'
        ? <Notifications onUnreadChange={handleNotificationsCountChange} onNavigate={handleNotificationNavigate} />
        : renderActivePage()
      }
    </AppShell>
  )
}

export default EmployeeShell
