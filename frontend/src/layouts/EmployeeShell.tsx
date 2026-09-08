import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarCheck, ClipboardList, MessageSquareWarning, Store as StoreIcon } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import { getInitials } from '../utils/initials'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { useIssueUnreadBadge } from '../hooks/useIssueUnreadBadge'
import AppShell from './AppShell'
import EmployeeDashboard from '../pages/EmployeeDashboard'
import EmployeeHistory from '../pages/EmployeeHistory'
import EmployeeIssues from '../pages/EmployeeIssues'
import Notifications from '../pages/Notifications'
import Profile from '../pages/Profile'
import Help from '../pages/Help'
import Settings from '../pages/Settings'
import EmployeeSearchDropdown from '../components/EmployeeSearchDropdown'

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
  { key: 'today', label: 'Checklist', icon: CalendarCheck },
  { key: 'audits', label: 'History', icon: ClipboardList },
  { key: 'issues', label: 'Issues', icon: MessageSquareWarning },
]

type Overlay = 'profile' | 'help' | 'settings' | 'notifications' | null

function EmployeeShell({ user, store, stores, onLogout, onSwitchStore, loggingOut, avatarUrl, onAvatarChange, employeeId = null }: EmployeeShellProps) {
  const [activeTab, setActiveTab] = useState<EmployeeNavTabKey>('today')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [mountedTabs, setMountedTabs] = useState<Set<EmployeeNavTabKey>>(new Set(['today']))
  const prevTab = useRef<EmployeeNavTabKey>('today')
  useEffect(() => {
    if (prevTab.current === activeTab) return
    prevTab.current = activeTab
    setMountedTabs((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab])
  const isMobile = useIsMobile()
  const { count: unreadCount, setCount } = useUnreadCount()
  const { hasUnread: issuesBadge, markSeen: markIssuesSeen } = useIssueUnreadBadge(employeeId ?? null, store.id)
  const canSwitchStore = stores.length > 1

  useEffect(() => {
    if (activeTab === 'issues') markIssuesSeen()
  }, [activeTab])

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName])

  function handleNotificationsCountChange(value: number) {
    if (value === 0) setCount(0)
    else setCount((prev) => Math.max(0, prev + value))
  }

  function handleNotificationNavigate(path: string) {
    switch (path) {
      case '/checklist': setActiveTab('today'); setOverlay(null); break
      case '/audit': setActiveTab('audits'); setOverlay(null); break
      case '/issues': setActiveTab('issues'); setOverlay(null); break
      default: setOverlay('notifications'); break
    }
  }

  const ALL_EMPLOYEE_TABS: EmployeeNavTabKey[] = ['today', 'audits', 'issues']

  const contextLabel = overlay === 'profile' ? 'My Profile'
    : overlay === 'help' ? 'Help & Guidance'
    : overlay === 'settings' ? 'Settings'
    : store.name

  const headerTitle = isMobile ? 'NForce RetailOps' : contextLabel
  const headerSubtitle = isMobile ? contextLabel : undefined

  function handleSearchNavigate(target: 'today' | 'issues') {
    setOverlay(null)
    setActiveTab(target)
  }

  const tabBadges = useMemo(
    () => (issuesBadge ? { issues: true as const } : {}),
    [issuesBadge],
  )

  return (
    <AppShell<EmployeeNavTabKey>
      navItems={NAV_ITEMS}
      activeTab={activeTab}
      tabBadges={tabBadges}
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
      onSettingsClick={() => setOverlay('settings')}
      onNotificationsClick={() => setOverlay('notifications')}
      onNotificationNavigate={handleNotificationNavigate}
      notificationUnreadCount={unreadCount}
      onNotificationsCountChange={handleNotificationsCountChange}
      avatarUrl={avatarUrl}
      mobileNav="bottom-tabs"
      showSearch={false}
      headerActions={
        <>
          <EmployeeSearchDropdown storeId={store.id} onNavigate={handleSearchNavigate} />
          {canSwitchStore && (
            <button
              type="button"
              className="btn btn--secondary switch-store-btn"
              onClick={onSwitchStore}
              aria-label="Switch Store"
            >
              <StoreIcon size={16} />
              <span className="switch-store-btn__label">Switch Store</span>
            </button>
          )}
        </>
      }
    >
      {overlay === 'profile'
        ? <Profile initials={userInitials} avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} />
        : overlay === 'help'
        ? <Help />
        : overlay === 'settings'
        ? <Settings />
        : overlay === 'notifications'
        ? <Notifications onUnreadChange={handleNotificationsCountChange} onNavigate={handleNotificationNavigate} />
        : ALL_EMPLOYEE_TABS.map((tab) =>
            mountedTabs.has(tab) ? (
              <div key={tab} style={activeTab !== tab ? { display: 'none' } : undefined}>
                {tab === 'today' && (
                  <EmployeeDashboard
                    store={store}
                    onLogout={onLogout}
                    loggingOut={false}
                    employeeId={employeeId}
                    employeeName={user.fullName}
                    onNavigate={(t) => { setOverlay(null); setActiveTab(t) }}
                  />
                )}
                {tab === 'audits' && <EmployeeHistory store={store} stores={stores} />}
                {tab === 'issues' && <EmployeeIssues store={store} />}
              </div>
            ) : null,
          )
      }
    </AppShell>
  )
}

export default EmployeeShell
