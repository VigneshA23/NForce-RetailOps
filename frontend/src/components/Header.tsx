import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Menu, Moon, Search, Sun } from 'lucide-react';
import SearchInput from './SearchInput';
import IconButton from './IconButton';
import ProfileMenu from './ProfileMenu';
import NotificationBell from './NotificationBell';
import type { StoreSummary } from '../types/store';
import type { NotificationNavigateHandler } from '../utils/notificationRoutes';
import './Header.css';

interface HeaderProps {
  title: string;
  // Shown as a second, smaller line under the title (e.g. Employee's
  // currently selected store name) -- optional, so other shells' single-line
  // title is unaffected when omitted.
  subtitle?: string;
  // Optional brand logo rendered to the left of the title/subtitle -- omitted
  // by default, so Admin/Super Admin headers stay exactly as-is.
  logoSrc?: string;
  // When true, hides the logo at tablet/desktop widths -- for callers that
  // sit behind a sidebar already carrying the same brand mark, where this
  // would otherwise be a redundant second copy. Ignored below the mobile
  // breakpoint, and has no effect when logoSrc isn't set.
  hideLogoOnDesktop?: boolean;
  showSearch?: boolean;
  showNotifications?: boolean;
  notificationUnreadCount?: number;
  onNotificationsCountChange?: (count: number) => void;
  onNotificationsClick?: () => void;
  onNotificationNavigate?: NotificationNavigateHandler;
  notificationStoreId?: number;
  notificationStores?: StoreSummary[];
  searchValue: string;
  onSearchChange: (value: string) => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  userName: string;
  avatarUrl?: string | null;
  onProfileClick?: () => void;
  onOwnersClick?: () => void;
  onStoresClick?: () => void;
  onEmployeesClick?: () => void;
  onCategoriesClick?: () => void;
  onHelpClick?: () => void;
  onSettingsClick?: () => void;
  onIssuesClick?: () => void;
  onInventoryClick?: () => void;
  onOrdersClick?: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
  // See Modal's `centered` prop. Forwarded down to the logout confirmation
  // dialog inside ProfileMenu.
  centeredModals?: boolean;
  onMenuClick?: () => void;
  // Extra page-specific action(s) rendered before the search box (e.g. the
  // Employee shell's "Switch Store" button) -- optional, so Admin's Header
  // stays exactly as-is when nothing is passed.
  actions?: ReactNode;
}

function Header({
  title,
  subtitle,
  logoSrc,
  hideLogoOnDesktop,
  showSearch = true,
  showNotifications = true,
  notificationUnreadCount = 0,
  onNotificationsCountChange,
  onNotificationsClick,
  onNotificationNavigate,
  notificationStoreId,
  notificationStores,
  searchValue,
  onSearchChange,
  isDarkTheme,
  onToggleTheme,
  userName,
  avatarUrl,
  onProfileClick,
  onOwnersClick,
  onStoresClick,
  onEmployeesClick,
  onCategoriesClick,
  onHelpClick,
  onSettingsClick,
  onIssuesClick,
  onInventoryClick,
  onOrdersClick,
  onLogout,
  loggingOut,
  centeredModals,
  onMenuClick,
  actions,
}: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searchOpen) return;
    searchWrapRef.current?.querySelector('input')?.focus();
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setSearchOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [searchOpen]);

  return (
    <header className="header">
      <div className="header__left">
        {onMenuClick && (
          <IconButton icon={Menu} ariaLabel="Open navigation menu" onClick={onMenuClick} />
        )}
        {logoSrc && (
          <img
            src={logoSrc}
            alt=""
            className={`header__logo${hideLogoOnDesktop ? ' header__logo--hide-desktop' : ''}`}
          />
        )}
        {/* Platform logo + name, desktop/tablet only: the header spans the
            full width above the dock sidebar, which is too narrow to carry
            them. On mobile the logoSrc image above and the drawer cover it. */}
        <div className="header__platform">
          <img src="/nforce-logo.png" alt="NForce logo" className="header__platform-logo" />
          <div className="header__platform-text">
            <span className="header__platform-name">NForce RetailOps</span>
            <span className="header__platform-tagline">Store Ops Platform</span>
          </div>
        </div>
        <span className="header__platform-divider" aria-hidden="true" />
        <div className="header__brand">
          <h1 className="header__title">{title}</h1>
          {subtitle && <span className="header__subtitle">{subtitle}</span>}
        </div>
      </div>
      <div className="header__right">
        {actions}
        {showSearch && (
          <div
            ref={searchWrapRef}
            className={`header__search-wrap${searchOpen ? ' header__search-wrap--open' : ''}`}
          >
            <SearchInput value={searchValue} onChange={onSearchChange} />
            <button
              type="button"
              className="header__search-icon-trigger"
              aria-label="Open search"
              aria-expanded={searchOpen}
              onClick={() => setSearchOpen((open) => !open)}
            >
              <Search size={18} aria-hidden="true" />
            </button>
          </div>
        )}
        <IconButton
          icon={isDarkTheme ? Sun : Moon}
          ariaLabel={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={onToggleTheme}
        />
        {showNotifications && onNotificationsClick && (
          <NotificationBell
            unreadCount={notificationUnreadCount}
            onCountChange={onNotificationsCountChange ?? (() => {})}
            onViewAll={onNotificationsClick}
            onNavigate={onNotificationNavigate}
            activeStoreId={notificationStoreId}
            assignedStores={notificationStores}
          />
        )}
        <ProfileMenu
          fullName={userName}
          avatarUrl={avatarUrl}
          onProfileClick={onProfileClick}
          onOwnersClick={onOwnersClick}
          onStoresClick={onStoresClick}
          onEmployeesClick={onEmployeesClick}
          onCategoriesClick={onCategoriesClick}
          onHelpClick={onHelpClick}
          onSettingsClick={onSettingsClick}
          onIssuesClick={onIssuesClick}
          onInventoryClick={onInventoryClick}
          onOrdersClick={onOrdersClick}
          onLogout={onLogout}
          loggingOut={loggingOut}
          centeredModals={centeredModals}
        />
      </div>
    </header>
  );
}

export default Header;
