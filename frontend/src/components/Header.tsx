import { Bell, Moon, Sun } from 'lucide-react';
import SearchInput from './SearchInput';
import IconButton from './IconButton';
import './Header.css';

interface HeaderProps {
  title: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  isDarkTheme: boolean;
  onToggleTheme: () => void;
}

function Header({ title, searchValue, onSearchChange, isDarkTheme, onToggleTheme }: HeaderProps) {
  return (
    <header className="header">
      <div className="header__left">
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
      </div>
    </header>
  );
}

export default Header;
