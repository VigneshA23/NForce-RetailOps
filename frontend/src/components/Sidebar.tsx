import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { PanelLeft } from 'lucide-react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser, Role } from '../types/auth';
import { useIsMobile, useIsTabletDown } from '../hooks/useMediaQuery';
import UserAvatar from './UserAvatar';
import './Sidebar.css';

interface HoveredTooltip {
  label: string;
  top: number;
  left: number;
}

interface SidebarProps<Key extends string = NavTabKey> {
  items: NavItem<Key>[];
  activeKey: Key;
  onSelect: (key: Key) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen?: boolean;
  onClose?: () => void;
  user: AuthUser;
  avatarUrl?: string | null;
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
  avatarUrl,
}: SidebarProps<Key>) {
  const isMobile = useIsMobile();
  const isTabletDown = useIsTabletDown();
  // Mirrors the CSS: collapsed explicitly, or forced narrow at tablet-down
  // widths -- except on mobile, where the drawer is always full width
  // regardless of the collapsed toggle (see Sidebar.css's --mobile block).
  const isIconOnly = !isMobile && (collapsed || isTabletDown);
  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredTooltip | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose?.();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onClose]);

  // Tooltips are portalled to <body> instead of living inside the sidebar
  // markup, because .sidebar needs overflow-x: hidden for its collapse
  // animation, which would otherwise clip a tooltip escaping to the right
  // of an icon-only rail.
  function showTooltip(label: string, target: HTMLElement) {
    if (!isIconOnly) return;
    const rect = target.getBoundingClientRect();
    setHoveredTooltip({ label, top: rect.top + rect.height / 2, left: rect.right + 8 });
  }

  function hideTooltip() {
    setHoveredTooltip(null);
  }

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
              <span className="sidebar__brand-subtitle">Store Ops Platform</span>
            </div>
            <button
              type="button"
              className="sidebar__collapse-toggle"
              onClick={onToggleCollapsed}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              aria-expanded={!collapsed}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              <PanelLeft size={18} />
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
                      onMouseEnter={(event) => showTooltip(item.label, event.currentTarget)}
                      onMouseLeave={hideTooltip}
                      onFocus={(event) => showTooltip(item.label, event.currentTarget)}
                      onBlur={hideTooltip}
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
            <UserAvatar initials={getInitials(user.fullName)} size={32} src={avatarUrl} />
            <div className="sidebar__profile-text sidebar__label">
              <span className="sidebar__profile-name">{user.fullName}</span>
              <span className="sidebar__profile-role">{ROLE_LABELS[user.role]}</span>
            </div>
          </div>
        </div>
      </aside>
      {hoveredTooltip &&
        createPortal(
          <div
            className="sidebar-tooltip-portal"
            role="tooltip"
            style={{ top: hoveredTooltip.top, left: hoveredTooltip.left }}
          >
            {hoveredTooltip.label}
          </div>,
          document.body,
        )}
    </>
  );
}

export default Sidebar;
