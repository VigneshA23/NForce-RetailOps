import { useState } from 'react';
import type { NavTabKey } from '../types/navigation';
import { OWNER_NAV_ITEMS, PAGE_TITLES } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import AppShell from './AppShell';
import Employees from '../pages/Employees';
import Categories from '../pages/Categories';
import Home from '../pages/Home';
import Stores from '../pages/Stores';
import Tasks from '../pages/Tasks';
import History from '../pages/History';
import Settings from '../pages/Settings';

function renderActivePage(activeTab: NavTabKey, onNavigateToCategories: () => void) {
  switch (activeTab) {
    case 'home':
      return <Home />;
    case 'store-management':
      return <Stores />;
    case 'employees':
      return <Employees />;
    case 'categories':
      return <Categories />;
    case 'tasks':
      return <Tasks onNavigateToCategories={onNavigateToCategories} />;
    case 'history':
      return <History />;
    case 'settings':
      return <Settings />;
    default: {
      const _exhaustive: never = activeTab;
      return _exhaustive;
    }
  }
}

interface DashboardShellProps {
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
}

function DashboardShell({ user, onLogout, loggingOut }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<NavTabKey>('home');

  return (
    <AppShell
      navItems={OWNER_NAV_ITEMS}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      title={PAGE_TITLES[activeTab]}
      user={user}
      onLogout={onLogout}
      loggingOut={loggingOut}
    >
      {renderActivePage(activeTab, () => setActiveTab('categories'))}
    </AppShell>
  );
}

export default DashboardShell;
