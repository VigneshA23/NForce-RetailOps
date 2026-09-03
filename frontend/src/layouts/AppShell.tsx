import { useState, type ReactNode } from 'react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import BottomNav from '../components/BottomNav';
import { useTheme } from '../hooks/useTheme';
import { useSidebarCollapsed } from '../hooks/useSidebarCollapsed';
import { useIsMobile } from '../hooks/useMediaQuery';
import './AppShell.css';

interface AppShellProps<Key extends string = NavTabKey> {
  navItems: NavItem<Key>[];
  activeTab: Key;
  onSelectTab: (key: Key) => void;
  title: string;
  // Forwarded to Header -- see Header's own prop docs. Optional, so shells
  // that don't pass them (Admin/Super Admin) render exactly as before.
  subtitle?: string;
  logoSrc?: string;
  hideLogoOnDesktop?: boolean;
  // Employee pages only -- see Modal's `centered` prop.
  centeredModals?: boolean;
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
  onProfileClick?: () => void;
  onHelpClick?: () => void;
  avatarUrl?: string | null;
  // Extra page-specific header action(s), forwarded to Header's `actions` slot.
  headerActions?: ReactNode;
  // 'drawer' (default): hamburger opens the sliding Sidebar on mobile, as
  // every shell has always worked. 'bottom-tabs': primary nav moves to a
  // fixed BottomNav on mobile instead (the Sidebar drawer trigger is hidden,
  // so it simply never opens -- no other Sidebar behavior changes).
  mobileNav?: 'drawer' | 'bottom-tabs';
  children: ReactNode;
}

function AppShell<Key extends string = NavTabKey>({
  navItems,
  activeTab,
  onSelectTab,
  title,
  subtitle,
  logoSrc,
  hideLogoOnDesktop,
  centeredModals,
  user,
  onLogout,
  loggingOut,
  onProfileClick,
  onHelpClick,
  avatarUrl,
  headerActions,
  mobileNav = 'drawer',
  children,
}: AppShellProps<Key>) {
  const { isDarkTheme, toggleTheme } = useTheme();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [searchValue, setSearchValue] = useState('');
  const isMobile = useIsMobile();
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const useBottomTabs = isMobile && mobileNav === 'bottom-tabs';

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
        avatarUrl={avatarUrl}
      />
      <div className="app-shell__content">
        <div className="app-shell__header">
          <Header
            title={title}
            subtitle={subtitle}
            logoSrc={logoSrc}
            hideLogoOnDesktop={hideLogoOnDesktop}
            centeredModals={centeredModals}
            searchValue={searchValue}
            onSearchChange={setSearchValue}
            isDarkTheme={isDarkTheme}
            onToggleTheme={toggleTheme}
            userName={user.fullName}
            avatarUrl={avatarUrl}
            onProfileClick={onProfileClick}
            onHelpClick={onHelpClick}
            onLogout={onLogout}
            loggingOut={loggingOut}
            onMenuClick={isMobile && !useBottomTabs ? () => setMobileDrawerOpen(true) : undefined}
            actions={headerActions}
          />
        </div>
        <main className={`app-shell__main${useBottomTabs ? ' app-shell__main--bottom-nav' : ''}`}>
          {children}
        </main>
      </div>
      {useBottomTabs && <BottomNav<Key> items={navItems} activeKey={activeTab} onSelect={onSelectTab} />}
    </div>
  );
}

export default AppShell;
