import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import { useIsMobile, useIsTabletNarrow } from '../hooks/useMediaQuery';
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
  tabBadges?: Partial<Record<string, boolean>>;
}

function Sidebar<Key extends string = NavTabKey>({
  items,
  activeKey,
  onSelect,
  collapsed,
  onToggleCollapsed,
  mobileOpen = false,
  onClose,
  tabBadges,
}: SidebarProps<Key>) {
  const isMobile = useIsMobile();
  const isTabletNarrow = useIsTabletNarrow();
  // Mirrors the CSS: collapsed explicitly, or forced narrow at the
  // 481-767px tablet-narrow band -- except on mobile, where the drawer is
  // always full width regardless of the collapsed toggle (see Sidebar.css's
  // --mobile block). iPad-width screens (768-1024px) and desktop behave the
  // same way: icon-only only when actually collapsed.
  const isIconOnly = !isMobile && (collapsed || isTabletNarrow);
  // The toggle only means something where the user can actually switch
  // between the two widths -- tablet-narrow is always icon-only and the
  // mobile drawer is always full width.
  const showToggle = !isMobile && !isTabletNarrow;
  const [hoveredTooltip, setHoveredTooltip] = useState<HoveredTooltip | null>(null);
  const asideRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose?.();
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [mobileOpen, onClose]);

  // Tooltips are portalled to <body> instead of living inside the sidebar
  // markup, because .sidebar needs overflow for its collapse animation and
  // its own scrolling, which would otherwise clip a tooltip escaping to the
  // right of the rail.
  //
  // Placed just past the rail's right edge rather than the icon's: the icon
  // magnifies on hover, so its resting rect is not where it ends up.
  function showTooltip(label: string, button: HTMLElement) {
    if (!isIconOnly) return;
    const icon = button.querySelector<HTMLElement>('.sidebar__dock-icon') ?? button;
    const iconRect = icon.getBoundingClientRect();
    const railRight = asideRef.current?.getBoundingClientRect().right ?? iconRect.right;
    setHoveredTooltip({ label, top: iconRect.top + iconRect.height / 2, left: railRight + 10 });
  }

  function hideTooltip() {
    setHoveredTooltip(null);
  }

  return (
    <>
      {mobileOpen && <div className="sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <aside
        ref={asideRef}
        className={`sidebar${collapsed ? ' sidebar--collapsed' : ''}${mobileOpen ? ' sidebar--mobile-open' : ''}`}
      >
        <div className="sidebar__brand">
          <img src="/nforce-logo.png" alt="NForce logo" className="sidebar__brand-logo" />
          {/* Mobile drawer only -- on desktop the logo and name are in the
              header (Header.tsx). */}
          <div className="sidebar__brand-text">
            <span className="sidebar__brand-title">NForce RetailOps</span>
            <span className="sidebar__brand-subtitle">Store Ops Platform</span>
          </div>
        </div>
        <nav className="sidebar__nav" aria-label="Primary">
          {/* A dock: each item magnifies on hover and nudges its neighbours
              apart. The neighbour rules in Sidebar.css use sibling
              selectors, so the items must stay direct siblings -- no <li>
              wrappers. */}
          <div className="sidebar__dock">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === activeKey;
              return (
                <button
                  key={item.key}
                  type="button"
                  className={`sidebar__dock-item${isActive ? ' sidebar__dock-item--active' : ''}`}
                  onClick={() => {
                    // Touch never fires mouseleave, so drop the tooltip here.
                    hideTooltip();
                    onSelect(item.key);
                    onClose?.();
                  }}
                  onMouseEnter={(event) => showTooltip(item.label, event.currentTarget)}
                  onMouseLeave={hideTooltip}
                  onFocus={(event) => showTooltip(item.label, event.currentTarget)}
                  onBlur={hideTooltip}
                  aria-label={item.label}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <span className="sidebar__dock-icon">
                    <Icon size={18} strokeWidth={1.8} />
                    {isActive && <span className="sidebar__dock-dot" aria-hidden="true" />}
                    {tabBadges?.[item.key] && <span className="sidebar__badge" aria-label="Unread" />}
                  </span>
                  <span className="sidebar__dock-label" aria-hidden="true">{item.label}</span>
                </button>
              );
            })}
            {showToggle && (
              <button
                type="button"
                className="sidebar__dock-toggle"
                onClick={() => {
                  hideTooltip();
                  onToggleCollapsed();
                }}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-expanded={!collapsed}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              >
                <ChevronLeft size={16} strokeWidth={2.2} className="sidebar__dock-toggle-icon" />
              </button>
            )}
          </div>
        </nav>
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
