import { ChevronLeft } from 'lucide-react';
import type { NavItem, NavTabKey } from '../types/navigation';
import './Sidebar.css';

interface SidebarProps {
  items: NavItem[];
  activeTab: NavTabKey;
  onSelect: (key: NavTabKey) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

function Sidebar({ items, activeTab, onSelect, isCollapsed, onToggleCollapse }: SidebarProps) {
  return (
    <aside className={`sidebar${isCollapsed ? ' sidebar--collapsed' : ''}`}>
      <div className="sidebar__brand">
        <img src="/nforce-logo.png" alt="NForce logo" className="sidebar__brand-logo" />
        {!isCollapsed && <span className="sidebar__brand-text">RETAILOPS</span>}
        <button
          type="button"
          className="sidebar__collapse-toggle"
          aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          onClick={onToggleCollapse}
        >
          <ChevronLeft size={16} className={isCollapsed ? 'sidebar__collapse-icon--flipped' : ''} />
        </button>
      </div>

      <nav className="sidebar__nav">
        {!isCollapsed && <div className="sidebar__section-label">Overview</div>}
        <ul className="sidebar__nav-list">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.key === activeTab;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  className={`sidebar__nav-item${isActive ? ' sidebar__nav-item--active' : ''}`}
                  onClick={() => onSelect(item.key)}
                  title={isCollapsed ? item.label : undefined}
                >
                  <Icon size={18} />
                  {!isCollapsed && <span>{item.label}</span>}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

export default Sidebar;
