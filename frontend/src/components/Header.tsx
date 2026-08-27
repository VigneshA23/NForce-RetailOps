import { Bell, Moon, Sun } from 'lucide-react';
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
  onLogout: () => void;
  loggingOut?: boolean;
}

function Header({
  title,
  searchValue,
  onSearchChange,
  isDarkTheme,
  onToggleTheme,
  userName,
  onLogout,
  loggingOut,
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
        <ProfileMenu fullName={userName} onLogout={onLogout} loggingOut={loggingOut} />
      </div>
    </header>
  );
}

export default Header;
