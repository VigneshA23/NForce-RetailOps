import { useState } from 'react'
import { CalendarCheck, History as HistoryIcon, Inbox, Moon, Store as StoreIcon, Sun } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import { useIsMobile } from '../hooks/useMediaQuery'
import { useTheme } from '../hooks/useTheme'
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed'
import Sidebar from '../components/Sidebar'
import IconButton from '../components/IconButton'
import PlaceholderPage from '../components/PlaceholderPage'
import ProfileMenu from '../components/ProfileMenu'
import BottomNav from '../components/BottomNav'
import EmployeeDashboard from '../pages/EmployeeDashboard'
import EmployeeHistory from '../pages/EmployeeHistory'
import './EmployeeShell.css'

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

function EmployeeShell({ user, store, stores, onLogout, onSwitchStore, loggingOut }: EmployeeShellProps) {
  const [activeTab, setActiveTab] = useState<EmployeeNavTabKey>('today')
  const isMobile = useIsMobile()
  const { isDarkTheme, toggleTheme } = useTheme()
  const [collapsed, setCollapsed] = useSidebarCollapsed()
  // With a single assigned store there is nothing to switch to -- the control
  // would only lead to a one-option picker and straight back here.
  const canSwitchStore = stores.length > 1

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

  return (
    <div className="employee-shell">
      {!isMobile && (
        <Sidebar<EmployeeNavTabKey>
          items={NAV_ITEMS}
          activeKey={activeTab}
          onSelect={setActiveTab}
          collapsed={collapsed}
          onToggleCollapsed={() => setCollapsed((current) => !current)}
          user={user}
        />
      )}

      <div className="employee-shell-content">
        <div className="employee-shell-topbar">
          <div className="employee-shell-topbar-store">{store.name}</div>
          <div className="employee-shell-topbar-actions">
            {canSwitchStore && (
              <button type="button" className="btn btn--secondary" onClick={onSwitchStore}>
                <StoreIcon size={16} />
                Switch Store
              </button>
            )}
            <IconButton
              icon={isDarkTheme ? Sun : Moon}
              ariaLabel={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
              onClick={toggleTheme}
              variant="accent"
            />
            <ProfileMenu fullName={user.fullName} onLogout={onLogout} loggingOut={loggingOut} />
          </div>
        </div>

        <main className="employee-shell-main">{renderActivePage()}</main>
      </div>

      {isMobile && <BottomNav items={NAV_ITEMS} activeKey={activeTab} onSelect={setActiveTab} />}
    </div>
  )
}

export default EmployeeShell
