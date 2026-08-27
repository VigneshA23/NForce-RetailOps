import { Bell, Moon, Sun } from 'lucide-react';
import SearchInput from './SearchInput';
import IconButton from './IconButton';
import UserMenu from './UserMenu';
import './Header.css';

interface HeaderProps {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  userInitials: string;
  fullName: string;
  roleLabel: string;
  onProfileClick: () => void;
  onHelpClick: () => void;
  onSignOut: () => void;
}

function Header({
  title,
  searchValue,
  onSearchChange,
  isDarkTheme,
  onToggleTheme,
  userInitials,
  fullName,
  roleLabel,
  onProfileClick,
  onHelpClick,
  onSignOut,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="header__left">
        <div className="header__brand">
          <img src="/nforce-logo.png" alt="NForce logo" className="header__brand-logo" />
          <div className="header__brand-text">
            <span className="header__brand-title">NForce RetailOps</span>
            <span className="header__brand-subtitle">Retail Store Operations Platform</span>
          </div>
        </div>
        <span className="header__divider" aria-hidden="true" />
        <h1 className="header__title">{title}</h1>
      </div>
      <div className="header__right">
        <SearchInput value={searchValue} onChange={onSearchChange} />
        <IconButton
          icon={isDarkTheme ? Sun : Moon}
          ariaLabel={isDarkTheme ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={onToggleTheme}
          variant="accent"
        />
        <IconButton icon={Bell} ariaLabel="Notifications" />
        <UserMenu
          initials={userInitials}
          fullName={fullName}
          roleLabel={roleLabel}
          onProfileClick={onProfileClick}
          onHelpClick={onHelpClick}
          onSignOut={onSignOut}
        />
      </div>
    </header>
  );
}

export default Header;
