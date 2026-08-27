import { Bell, Moon, Sun } from 'lucide-react';
import SearchInput from './SearchInput';
import IconButton from './IconButton';
import UserAvatar from './UserAvatar';
import './Header.css';

interface HeaderProps {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
  userInitials?: string;
}

function Header({
  title,
  searchValue,
  onSearchChange,
  isDarkTheme,
  onToggleTheme,
  userInitials = 'JB',
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
        <UserAvatar initials={userInitials} />
      </div>
    </header>
  );
}

export default Header;
