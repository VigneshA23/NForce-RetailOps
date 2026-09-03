import type { ReactNode } from 'react';
import { Bell, Menu, Moon, Sun } from 'lucide-react';
import SearchInput from './SearchInput';
import IconButton from './IconButton';
import ProfileMenu from './ProfileMenu';
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
  searchValue: string;
  onSearchChange: (value: string) => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  userName: string;
  onProfileClick?: () => void;
  onHelpClick?: () => void;
  onLogout: () => void;
  loggingOut?: boolean;
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
  searchValue,
  onSearchChange,
  isDarkTheme,
  onToggleTheme,
  userName,
  onProfileClick,
  onHelpClick,
  onLogout,
  loggingOut,
  onMenuClick,
  actions,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header__left">
        {onMenuClick && (
          <IconButton icon={Menu} ariaLabel="Open navigation menu" onClick={onMenuClick} />
        )}
        {logoSrc && <img src={logoSrc} alt="" className="header__logo" />}
        <div className="header__brand">
          <h1 className="header__title">{title}</h1>
          {subtitle && <span className="header__subtitle">{subtitle}</span>}
        </div>
      </div>
      <div className="header__right">
        {actions}
        <SearchInput value={searchValue} onChange={onSearchChange} />
        <IconButton
          icon={isDarkTheme ? Sun : Moon}
          ariaLabel={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={onToggleTheme}
          variant="accent"
        />
        <IconButton icon={Bell} ariaLabel="Notifications" />
        <ProfileMenu
          fullName={userName}
          onProfileClick={onProfileClick}
          onHelpClick={onHelpClick}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
      </div>
    </header>
  );
}

export default Header;
