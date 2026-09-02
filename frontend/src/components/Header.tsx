import type { ReactNode } from 'react';
import { Bell, Menu, Moon, Sun } from 'lucide-react';
import SearchInput from './SearchInput';
import IconButton from './IconButton';
import ProfileMenu from './ProfileMenu';
import './Header.css';

interface HeaderProps {
  title: string;
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
        <h1 className="header__title">{title}</h1>
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
