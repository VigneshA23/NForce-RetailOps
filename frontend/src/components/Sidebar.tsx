import { useEffect, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { PanelLeft, Snowflake } from 'lucide-react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import { useIsMobile, useIsTabletNarrow } from '../hooks/useMediaQuery';
import './Sidebar.css';

// Ice Blue palette -- decorative only, never applied to the sidebar's own
// UI (nav items, text, icons). See SidebarSnow below.
const SNOWFLAKE_COLORS = ['#BFEFFF', '#D9F6FF', '#A7DFF2', '#F4FCFF', '#8ED8F0'];

interface SnowflakeConfig {
  left: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  drift: number;
  spin: number;
  color: string;
  glow: boolean;
}

// Computed once at module load (not per render/mount) -- a fixed set of
// randomized flakes is visually indistinguishable from re-randomizing on
// every mount, and this avoids regenerating the array (and re-triggering
// every flake's animation from its 0% keyframe at once) whenever a shell
// remounts Sidebar.
const SNOWFLAKES: SnowflakeConfig[] = Array.from({ length: 14 }, (_, index) => ({
  left: Math.round(Math.random() * 100),
  size: 6 + Math.round(Math.random() * 8), // 6-14px
  duration: 12 + Math.random() * 10, // 12-22s
  delay: -(Math.random() * 20), // negative delay staggers flakes mid-fall on first paint
  opacity: 0.25 + Math.random() * 0.35, // 0.25-0.6, kept low so nav stays the focus
  drift: Math.random() * 28 - 14, // -14px to +14px horizontal sway
  spin: Math.random() * 240 - 120, // -120deg to +120deg over the fall
  color: SNOWFLAKE_COLORS[index % SNOWFLAKE_COLORS.length],
  glow: index % 4 === 0, // only a few get the subtle glow, kept rare and soft
}));

// Purely decorative winter atmosphere behind the nav content -- aria-hidden,
// pointer-events: none, and absolutely positioned within .sidebar (which is
// already a positioned element), so it can never capture clicks/focus,
// never affects layout/scroll height (transform/opacity only), and is
// clipped to the sidebar's own bounds at every breakpoint including the
// collapsed icon-only rail and the mobile drawer.
function SidebarSnow() {
  return (
    <div className="sidebar__snow" aria-hidden="true">
      {SNOWFLAKES.map((flake, index) => (
        <Snowflake
          key={index}
          className={`sidebar__snowflake${flake.glow ? ' sidebar__snowflake--glow' : ''}`}
          color={flake.color}
          size={flake.size}
          style={
            {
              left: `${flake.left}%`,
              opacity: flake.opacity,
              animationDuration: `${flake.duration}s`,
              animationDelay: `${flake.delay}s`,
              '--snow-drift': `${flake.drift}px`,
              '--snow-spin': `${flake.spin}deg`,
              '--snow-opacity': flake.opacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}

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
  //
  // Positioned off the icon itself, not the full-width nav button -- the
  // button spans the entire (now-centered) rail, so anchoring to its right
  // edge left a wide gap between the icon and its tooltip.
  function showTooltip(label: string, button: HTMLElement) {
    if (!isIconOnly) return;
    const icon = button.querySelector<HTMLElement>('.sidebar__icon') ?? button;
    const rect = icon.getBoundingClientRect();
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
        <SidebarSnow />
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
                        {tabBadges?.[item.key] && <span className="sidebar__badge" aria-label="Unread" />}
                      </span>
                      <span className="sidebar__label">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
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
