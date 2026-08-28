import { useState, type ReactNode } from 'react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import { ROLE_LABELS } from '../types/auth';
import { getInitials } from '../utils/user';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../hooks/useTheme';
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed';
import './AppShell.css';

interface AppShellProps {
  navItems: NavItem[];
  activeTab: NavTabKey;
  onSelectTab: (key: NavTabKey) => void;
  title: string;
  user: AuthUser;
  children: ReactNode;
}

function AppShell({ navItems, activeTab, onSelectTab, title, user, children }: AppShellProps) {
  const [isDarkTheme, setIsDarkTheme] = useTheme();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [searchValue, setSearchValue] = useState('');

  return (
    <div className="app-shell">
      <Sidebar
        items={navItems}
        activeKey={activeTab}
        onSelect={onSelectTab}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
        userName={user.fullName}
        userRoleLabel={ROLE_LABELS[user.role]}
        userInitials={getInitials(user.fullName)}
      />
      <div className="app-shell__content">
        <div className="app-shell__header">
          <Header
            title={title}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            isDarkTheme={isDarkTheme}
            onToggleTheme={() => setIsDarkTheme((current) => !current)}
          />
        </div>
        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
