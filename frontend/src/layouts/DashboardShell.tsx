import { useMemo, useState } from 'react';
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
import Profile from '../pages/Profile';
import Help from '../pages/Help';
import { getInitials } from '../utils/initials';

function renderActivePage(activeTab: NavTabKey, onNavigateToCategories: () => void, userName: string) {
  switch (activeTab) {
    case 'home':
      return <Home userName={userName} />;
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

type Overlay = 'profile' | 'help' | null;

function DashboardShell({ user, onLogout, loggingOut }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<NavTabKey>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName]);

  const title = overlay === 'profile' ? 'My Profile' : overlay === 'help' ? 'Help & Guidance' : PAGE_TITLES[activeTab];

  return (
    <AppShell
      navItems={OWNER_NAV_ITEMS}
      activeTab={activeTab}
      onSelectTab={(key) => {
        setOverlay(null);
        setActiveTab(key);
      }}
      title={title}
      user={user}
      onLogout={onLogout}
      loggingOut={loggingOut}
      onProfileClick={() => setOverlay('profile')}
      onHelpClick={() => setOverlay('help')}
    >
      {overlay === 'profile' ? (
        <Profile initials={userInitials} />
      ) : overlay === 'help' ? (
        <Help />
      ) : (
        renderActivePage(activeTab, () => setActiveTab('categories'), user.fullName)
      )}
    </AppShell>
  );
}

export default DashboardShell;
