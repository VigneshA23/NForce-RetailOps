import type { ReactNode } from 'react';
import { Menu, Moon, Sun } from 'lucide-react';
import SearchInput from './SearchInput';
import IconButton from './IconButton';
import ProfileMenu from './ProfileMenu';
import NotificationBell from './NotificationBell';
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
  onNotificationNavigate?: (path: string) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  userName: string;
  avatarUrl?: string | null;
  onProfileClick?: () => void;
  onHelpClick?: () => void;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
  // Employee pages only -- see Modal's `centered` prop. Forwarded down to the
  // logout confirmation dialog inside ProfileMenu.
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
  searchValue,
  onSearchChange,
  isDarkTheme,
  onToggleTheme,
  userName,
  avatarUrl,
  onProfileClick,
  onHelpClick,
  onHistoryClick,
  onSettingsClick,
  onLogout,
  loggingOut,
  centeredModals,
  onMenuClick,
  actions,
}: HeaderProps) {
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
        <div className="header__brand">
          <h1 className="header__title">{title}</h1>
          {subtitle && <span className="header__subtitle">{subtitle}</span>}
        </div>
      </div>
      <div className="header__right">
        {actions}
        {showSearch && <SearchInput value={searchValue} onChange={onSearchChange} />}
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
          />
        )}
        <ProfileMenu
          fullName={userName}
          avatarUrl={avatarUrl}
          onProfileClick={onProfileClick}
          onHelpClick={onHelpClick}
          onHistoryClick={onHistoryClick}
          onSettingsClick={onSettingsClick}
          onLogout={onLogout}
          loggingOut={loggingOut}
          centeredModals={centeredModals}
        />
      </div>
    </header>
  );
}

export default Header;
