import { useState, type ReactNode } from 'react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../hooks/useTheme';
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed';
import './AppShell.css';

interface AppShellProps<Key extends string = NavTabKey> {
  navItems: NavItem<Key>[];
  activeTab: Key;
  onSelectTab: (key: Key) => void;
  title: string;
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
  children: ReactNode;
}

function AppShell<Key extends string = NavTabKey>({
  navItems,
  activeTab,
  onSelectTab,
  title,
  user,
  onLogout,
  loggingOut,
  children,
}: AppShellProps<Key>) {
  const { isDarkTheme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [searchValue, setSearchValue] = useState('');

  return (
    <div className="app-shell">
      <Sidebar<Key>
        items={navItems}
        activeKey={activeTab}
        onSelect={onSelectTab}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
      />
      <div className="app-shell__content">
        <div className="app-shell__header">
          <Header
            title={title}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            isDarkTheme={isDarkTheme}
            onToggleTheme={toggleTheme}
            userName={user.fullName}
            onLogout={onLogout}
            loggingOut={loggingOut}
          />
        </div>
        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
