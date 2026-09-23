import { useEffect, useMemo, useRef, useState } from 'react'
import { CalendarCheck, CalendarX, ClipboardList, MessageSquareWarning, Store as StoreIcon } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import { getEmployeeOverlay, getEmployeeTab, setEmployeeOverlay, setEmployeeTab } from '../utils/navigationStorage'
import { getInitials } from '../utils/initials'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { useIssueUnreadBadge } from '../hooks/useIssueUnreadBadge'
import { useMissedTasksBadge } from '../hooks/useMissedTasksBadge'
import AppShell from './AppShell'
import EmployeeDashboard from '../pages/EmployeeDashboard'
import EmployeeHistory from '../pages/EmployeeHistory'
import EmployeeIssues from '../pages/EmployeeIssues'
import EmployeeStockCheck from '../pages/EmployeeStockCheck'
import MissingTasks from '../pages/MissingTasks'
import Notifications from '../pages/Notifications'
import Profile from '../pages/Profile'
import Help from '../pages/Help'
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
  onProfileUpdate?: (fullName: string) => void
  employeeId?: number | null
}

const NAV_ITEMS: EmployeeNavItem[] = [
  { key: 'today', label: 'Checklist', icon: CalendarCheck },
  { key: 'audits', label: 'History', icon: ClipboardList },
  { key: 'missing', label: 'Missing Tasks', icon: CalendarX },
  { key: 'issues', label: 'Issues', icon: MessageSquareWarning },
]

// "Missing Tasks" is too wide alongside 3 other labels at phone width, so the
// bottom tab bar uses a shorter "Missing" label -- same pattern as Owner's
// "Daily Checklist" -> "Checklist" shortening (see OWNER_BOTTOM_NAV_ITEMS).
const BOTTOM_NAV_ITEMS: EmployeeNavItem[] = NAV_ITEMS.map((item) =>
  item.key === 'missing' ? { ...item, label: 'Missing' } : item,
)

type Overlay = 'profile' | 'help' | 'notifications' | null

function EmployeeShell({ user, store, stores, onLogout, onSwitchStore, loggingOut, avatarUrl, onAvatarChange, onProfileUpdate, employeeId = null }: EmployeeShellProps) {
  // Restores the tab across a refresh, since there's no router to reflect it
  // in the URL -- see navigationStorage.ts for why.
  const [activeTab, setActiveTab] = useState<EmployeeNavTabKey>(() => getEmployeeTab() ?? 'today')
  useEffect(() => setEmployeeTab(activeTab), [activeTab])
  // Notifications/Profile/Help are an overlay on top of a tab, not a tab
  // itself, so restoring activeTab alone isn't enough -- restore this too.
  const [overlay, setOverlay] = useState<Overlay>(() => getEmployeeOverlay())
  useEffect(() => setEmployeeOverlay(overlay), [overlay])
  const [mobileSearchActive, setMobileSearchActive] = useState(false)
  // Seeds History's initial date with the clicked notification's own
  // createdAt, rather than History always defaulting to yesterday -- id
  // makes each click a distinct seed even if the same notification (and
  // therefore the same date) is opened twice in a row.
  const [historyDateSeed, setHistoryDateSeed] = useState<{ createdAt: string; id: number } | undefined>(undefined)
  // Search-result navigation into a specific task/issue -- `ts` makes
  // re-selecting the same result fire again even if it's already focused.
  const [focusTaskId, setFocusTaskId] = useState<{ taskId: number; ts: number } | undefined>(undefined)
  const [focusIssueId, setFocusIssueId] = useState<{ issueId: number; ts: number } | undefined>(undefined)
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
  const { count: missedCount, refresh: refreshMissedCount } = useMissedTasksBadge(store.id)
  const canSwitchStore = stores.length > 1

  useEffect(() => {
    if (activeTab === 'issues') markIssuesSeen()
  }, [activeTab])

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName])

  function handleNotificationsCountChange(value: number) {
    if (value === 0) setCount(0)
    else setCount((prev) => Math.max(0, prev + value))
  }

  function handleNotificationNavigate(path: string, createdAt?: string) {
    switch (path) {
      case '/checklist': setActiveTab('today'); setOverlay(null); break
      case '/audit':
        if (createdAt) setHistoryDateSeed({ createdAt, id: Date.now() })
        setActiveTab('audits'); setOverlay(null)
        break
      case '/issues': setActiveTab('issues'); setOverlay(null); break
      default: setOverlay('notifications'); break
    }
  }

  const ALL_EMPLOYEE_TABS: EmployeeNavTabKey[] = ['today', 'audits', 'issues', 'missing', 'stock-check']

  const contextLabel = overlay === 'profile' ? 'My Profile'
    : overlay === 'help' ? 'Help & Guidance'
    : store.name

  const headerTitle = isMobile ? 'NForce RetailOps' : contextLabel
  const headerSubtitle = isMobile ? contextLabel : undefined

  function handleSearchNavigate(target: 'today' | 'issues', id: number) {
    setOverlay(null)
    setActiveTab(target)
    if (target === 'today') setFocusTaskId({ taskId: id, ts: Date.now() })
    else setFocusIssueId({ issueId: id, ts: Date.now() })
  }

  const tabBadges = useMemo(
    () => ({
      ...(issuesBadge ? { issues: true as const } : {}),
      ...(missedCount > 0 ? { missing: true as const } : {}),
    }),
    [issuesBadge, missedCount],
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
      // Only overlay changes (Profile/Help/Notifications) should trigger
      // AppShell's cross-fade, which unmounts+remounts everything inside it --
      // keying this off activeTab too would fight the mountedTabs/display:none
      // persistence below, forcing every already-visited tab (including this
      // one's own missed-tasks fetch, the heaviest of the bunch) to refetch on
      // every single tab switch.
      contentKey={overlay ?? 'tabs'}
      logoSrc="/nforce-logo.png"
      hideLogoOnDesktop
      centeredModals
      user={user}
      onLogout={onLogout}
      loggingOut={loggingOut}
      onProfileClick={() => setOverlay('profile')}
      onHelpClick={() => setOverlay('help')}
      onNotificationsClick={() => setOverlay('notifications')}
      onNotificationNavigate={handleNotificationNavigate}
      notificationUnreadCount={unreadCount}
      onNotificationsCountChange={handleNotificationsCountChange}
      avatarUrl={avatarUrl}
      mobileNav="bottom-tabs"
      hideBottomNav={mobileSearchActive}
      bottomNavItems={BOTTOM_NAV_ITEMS}
      showSearch={false}
      headerActions={
        <>
          <EmployeeSearchDropdown
            storeId={store.id}
            onNavigate={handleSearchNavigate}
            onMobileOpenChange={setMobileSearchActive}
          />
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
        ? <Profile initials={userInitials} avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} onProfileUpdate={onProfileUpdate} />
        : overlay === 'help'
        ? <Help role={user.role} />
        : overlay === 'notifications'
        ? <Notifications
            onUnreadChange={handleNotificationsCountChange}
            onNavigate={handleNotificationNavigate}
            onBackToHome={() => { setOverlay(null); setActiveTab('today'); }}
          />
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
                    missedTasksCount={missedCount}
                    onNavigate={(t) => { setOverlay(null); setActiveTab(t) }}
                    focusTaskId={focusTaskId}
                  />
                )}
                {tab === 'audits' && <EmployeeHistory store={store} dateSeed={historyDateSeed} />}
                {tab === 'issues' && <EmployeeIssues store={store} focusIssueId={focusIssueId} />}
                {tab === 'missing' && <MissingTasks store={store} onCompleted={refreshMissedCount} />}
                {tab === 'stock-check' && <EmployeeStockCheck store={store} />}
              </div>
            ) : null,
          )
      }
    </AppShell>
  )
}

export default EmployeeShell
