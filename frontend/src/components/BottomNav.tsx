import type { EmployeeNavItem, EmployeeNavTabKey } from '../types/navigation'
import './BottomNav.css'

interface BottomNavProps {
  items: EmployeeNavItem[]
  activeKey: EmployeeNavTabKey
  onSelect: (key: EmployeeNavTabKey) => void
}

function BottomNav({ items, activeKey, onSelect }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Primary">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = activeKey === item.key
        return (
          <button
            key={item.key}
            type="button"
            className={`bottom-nav__item${isActive ? ' bottom-nav__item--active' : ''}`}
            onClick={() => onSelect(item.key)}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

export default BottomNav
