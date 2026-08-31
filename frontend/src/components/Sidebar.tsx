import { useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { NavItem, NavTabKey } from '../types/navigation';
import './Sidebar.css';

interface SidebarProps<Key extends string = NavTabKey> {
  items: NavItem<Key>[];
  activeKey: Key;
  onSelect: (key: Key) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen?: boolean;
  onClose?: () => void;
}

function Sidebar<Key extends string = NavTabKey>({
  items,
  activeKey,
  onSelect,
  collapsed,
  onToggleCollapsed,
  mobileOpen = false,
  onClose,
}: SidebarProps<Key>) {
  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose?.();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onClose]);

  return (
    <>
      {mobileOpen && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <aside
        className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${mobileOpen ? ' sidebar--mobile-open' : ''}`}
      >
        <div className="sidebar__top">
          <div className="sidebar__brand">
            <img src="/nforce-logo.png" alt="NForce logo" className="sidebar__brand-logo" />
            <div className="sidebar__brand-text sidebar__label">
              <span className="sidebar__brand-title">NForce RetailOps</span>
              <span className="sidebar__brand-subtitle">Retail Store Operations Platform</span>
            </div>
          </div>
          <nav className="sidebar__nav" aria-label="Primary">
            <ul className="sidebar__list">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === activeKey;
                return (
                  <li key={item.key}>
                    <button
                      type="button"
                      className={`sidebar__item${isActive ? ' sidebar__item--active' : ''}`}
                      onClick={() => {
                        onSelect(item.key);
                        onClose?.();
                      }}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <span className="sidebar__icon">
                        <Icon size={20} />
                      </span>
                      <span className="sidebar__label">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>
        <div className="sidebar__footer">
          <button
            type="button"
            className="sidebar__toggle"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
          >
            <span className="sidebar__icon">
              {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            </span>
            <span className="sidebar__label">Collapse</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
