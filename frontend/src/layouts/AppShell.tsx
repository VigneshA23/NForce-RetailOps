import { useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
  avatarUrl?: string | null;
  // Extra page-specific header action(s), forwarded to Header's `actions` slot.
  headerActions?: ReactNode;
  // When provided, AnimatePresence uses this as the key for the page content
  // wrapper — changing the key triggers a cross-fade+slide transition between
  // overlay states (Profile, History, Settings, Help) and tab content.
  contentKey?: string;
  // 'drawer' (default): hamburger opens the sliding Sidebar on mobile, as
  // every shell has always worked. 'bottom-tabs': primary nav moves to a
  // fixed BottomNav on mobile instead (the Sidebar drawer trigger is hidden,
  // so it simply never opens -- no other Sidebar behavior changes).
  mobileNav?: 'drawer' | 'bottom-tabs';
  // Items shown in the BottomNav specifically, when narrower than the full
  // desktop `navItems` list is wanted at phone width. Falls back to
  // `navItems` when omitted, so existing 'bottom-tabs' callers (Employee)
  // are unaffected.
  bottomNavItems?: NavItem<Key>[];
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
  onHistoryClick,
  onSettingsClick,
  avatarUrl,
  headerActions,
  contentKey,
  mobileNav = 'drawer',
  bottomNavItems,
  children,
}: AppShellProps<Key>) {
  const { isDarkTheme, toggleTheme } = useTheme();
  const prefersReducedMotion = useReducedMotion();
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
            onHistoryClick={onHistoryClick}
            onSettingsClick={onSettingsClick}
            onLogout={onLogout}
            loggingOut={loggingOut}
            onMenuClick={isMobile && !useBottomTabs ? () => setMobileDrawerOpen(true) : undefined}
            actions={headerActions}
          />
        </div>
        <main className={`app-shell__main${useBottomTabs ? ' app-shell__main--bottom-nav' : ''}`}>
          <AnimatePresence mode="sync">
            <motion.div
              key={contentKey ?? 'static'}
              className="app-shell__page"
              initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.992 }}
              animate={prefersReducedMotion ? {} : { opacity: 1, scale: 1 }}
              exit={prefersReducedMotion ? {} : { opacity: 0, scale: 1.008 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      {useBottomTabs && (
        <BottomNav<Key> items={bottomNavItems ?? navItems} activeKey={activeTab} onSelect={onSelectTab} />
      )}
    </div>
  );
}

export default AppShell;
