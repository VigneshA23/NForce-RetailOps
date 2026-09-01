import { useEffect } from 'react';
import { ChevronLeft } from 'lucide-react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser, Role } from '../types/auth';
import UserAvatar from './UserAvatar';
import './Sidebar.css';

interface SidebarProps<Key extends string = NavTabKey> {
  items: NavItem<Key>[];
  activeKey: Key;
  onSelect: (key: Key) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen?: boolean;
  onClose?: () => void;
  user: AuthUser;
}

const ROLE_LABELS: Record<Role, string> = {
  OWNER_ADMIN: 'Admin',
  EMPLOYEE: 'Employee',
  SUPER_ADMIN: 'Super Admin',
};

function getInitials(fullName: string): string {
  return fullName.charAt(0).toUpperCase() || '?';
}

function Sidebar<Key extends string = NavTabKey>({
  items,
  activeKey,
  onSelect,
  collapsed,
  onToggleCollapsed,
  mobileOpen = false,
  onClose,
  user,
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
            <button
              type="button"
              className="sidebar__collapse-toggle"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
            >
              <ChevronLeft size={18} className={collapsed ? 'sidebar__collapse-icon--rotated' : ''} />
            </button>
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
          <div className="sidebar__profile">
            <UserAvatar initials={getInitials(user.fullName)} size={32} />
            <div className="sidebar__profile-text sidebar__label">
              <span className="sidebar__profile-name">{user.fullName}</span>
              <span className="sidebar__profile-role">{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
