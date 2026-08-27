import { useState } from 'react'
import { CalendarCheck, HelpCircle, History as HistoryIcon, Inbox, LogOut, Settings, Store as StoreIcon } from 'lucide-react'
import type { AuthUser } from '../types/auth'
import type { StoreSummary } from '../types/store'
import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import PlaceholderPage from '../components/PlaceholderPage'
import EmployeeDashboard from '../pages/EmployeeDashboard'
import EmployeeHistory from '../pages/EmployeeHistory'
import './EmployeeShell.css'

interface EmployeeShellProps {
  user: AuthUser
  store: StoreSummary
  onLogout: () => void
  onSwitchStore: () => void
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

function EmployeeShell({ user, store, onLogout, onSwitchStore }: EmployeeShellProps) {
  const [activeTab, setActiveTab] = useState<EmployeeNavTabKey>('today')

  function renderActivePage() {
    switch (activeTab) {
      case 'today':
        return <EmployeeDashboard store={store} />
      case 'history':
        return <EmployeeHistory store={store} />
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

      <div className="employee-shell-content">
        <div className="employee-shell-topbar">
          <div className="employee-shell-topbar-store">{store.name}</div>
          <div className="employee-shell-topbar-actions">
            <button type="button" className="btn btn--secondary" onClick={onSwitchStore}>
              <StoreIcon size={16} />
              Switch Store
            </button>
            <div className="employee-shell-profile">
              <span className="employee-shell-avatar">{user.fullName.charAt(0).toUpperCase()}</span>
              <div>
                <div className="employee-shell-profile-name">{user.fullName}</div>
                <button type="button" className="employee-shell-logout" onClick={onLogout}>
                  <LogOut size={12} />
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>

        <main className="employee-shell-main">{renderActivePage()}</main>
      </div>
    </div>
  )
}

export default EmployeeShell
