import { useState, type ReactNode } from 'react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import { useTheme } from '../hooks/useTheme';
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed';
import { useIsMobile } from '../hooks/useMediaQuery';
import './AppShell.css';

interface AppShellProps<Key extends string = NavTabKey> {
  navItems: NavItem<Key>[];
  activeTab: Key;
  onSelectTab: (key: Key) => void;
  title: string;
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
  onProfileClick?: () => void;
  onHelpClick?: () => void;
  // Extra page-specific header action(s), forwarded to Header's `actions` slot.
  headerActions?: ReactNode;
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
  onProfileClick,
  onHelpClick,
  headerActions,
  children,
}: AppShellProps<Key>) {
  const { isDarkTheme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [searchValue, setSearchValue] = useState('');
  const isMobile = useIsMobile();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  return (
    <div className="app-shell">
      <Sidebar<Key>
        items={navItems}
        activeKey={activeTab}
        onSelect={onSelectTab}
        collapsed={collapsed}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
        mobileOpen={isMobile && mobileDrawerOpen}
        onClose={() => setMobileDrawerOpen(false)}
        user={user}
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
            onProfileClick={onProfileClick}
            onHelpClick={onHelpClick}
            onLogout={onLogout}
            loggingOut={loggingOut}
            onMenuClick={isMobile ? () => setMobileDrawerOpen(true) : undefined}
            actions={headerActions}
          />
        </div>
        <main className="app-shell__main">{children}</main>
      </div>
    </div>
  );
}

export default AppShell;
