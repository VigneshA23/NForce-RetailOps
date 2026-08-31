import { useState } from 'react'
import { CalendarCheck, HelpCircle, History as HistoryIcon, Inbox, Settings, Store as StoreIcon } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import { useIsMobile } from '../hooks/useMediaQuery'
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

const FOOTER_NAV_ITEMS: EmployeeNavItem[] = [
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'support', label: 'Support', icon: HelpCircle },
]

const ALL_NAV_ITEMS: EmployeeNavItem[] = [...NAV_ITEMS, ...FOOTER_NAV_ITEMS]

function EmployeeShell({ user, store, stores, onLogout, onSwitchStore, loggingOut }: EmployeeShellProps) {
  const [activeTab, setActiveTab] = useState<EmployeeNavTabKey>('today')
  const isMobile = useIsMobile()
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
      case 'settings':
        return <PlaceholderPage title="Settings" icon={Settings} />
      case 'support':
        return <PlaceholderPage title="Support" icon={HelpCircle} />
      default: {
        const _exhaustive: never = activeTab
        return _exhaustive
      }
    }
  }

  return (
    <div className="employee-shell">
      {!isMobile && (
        <nav className="employee-shell-sidebar">
          <div className="employee-shell-sidebar-brand">
            <img src="/nforce-logo.png" alt="NForce logo" className="employee-shell-sidebar-brand-logo" />
            <div>
              <div className="employee-shell-sidebar-brand-title">NForce RetailOps</div>
              <div className="employee-shell-sidebar-brand-subtitle">Retail Operations</div>
            </div>
          </div>
          <div className="employee-shell-sidebar-nav">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`employee-shell-nav-item${activeTab === item.key ? ' employee-shell-nav-item--active' : ''}`}
                  onClick={() => setActiveTab(item.key)}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
          <div className="employee-shell-sidebar-footer">
            {FOOTER_NAV_ITEMS.map((item) => {
              const Icon = item.icon
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`employee-shell-nav-item${activeTab === item.key ? ' employee-shell-nav-item--active' : ''}`}
                  onClick={() => setActiveTab(item.key)}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>
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
            <ProfileMenu fullName={user.fullName} onLogout={onLogout} loggingOut={loggingOut} />
          </div>
        </div>

        <main className="employee-shell-main">{renderActivePage()}</main>
      </div>

      {isMobile && <BottomNav items={ALL_NAV_ITEMS} activeKey={activeTab} onSelect={setActiveTab} />}
    </div>
  )
}

export default EmployeeShell
