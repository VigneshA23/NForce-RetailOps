import { useMemo, useState } from 'react';
import type { NavTabKey } from '../types/navigation';
import { OWNER_NAV_ITEMS, PAGE_TITLES } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import AppShell from './AppShell';
import Employees from '../pages/Employees';
import Categories from '../pages/Categories';
import Home from '../pages/Home';
import StoreDetail from '../pages/StoreDetail';
import Tasks from '../pages/Tasks';
import History from '../pages/History';
import Settings from '../pages/Settings';
import Profile from '../pages/Profile';
import Help from '../pages/Help';
import { getInitials } from '../utils/initials';
import { useOwnerStores } from '../hooks/useOwnerStores';
import { useOwnerCategories } from '../hooks/useOwnerCategories';
import { useOwnerEmployees } from '../hooks/useOwnerEmployees';

interface DashboardShellProps {
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
  avatarUrl?: string | null;
  onAvatarChange?: (url: string | null) => void;
}

type Overlay = 'profile' | 'help' | null;

function DashboardShell({ user, onLogout, loggingOut, avatarUrl, onAvatarChange }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<NavTabKey>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);

  // Fetched once here (not per-page) and shared as props, so switching tabs
  // never re-fetches data that hasn't changed. See useAssignedStores.ts for
  // the equivalent pattern already used on the employee side.
  const storesState = useOwnerStores();
  const categoriesState = useOwnerCategories();
  const employeesState = useOwnerEmployees();

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName]);

  const title = overlay === 'profile' ? 'My Profile' : overlay === 'help' ? 'Help & Guidance' : PAGE_TITLES[activeTab];

  function renderActivePage() {
    switch (activeTab) {
      case 'home':
        return (
          <Home
            userName={user.fullName}
            stores={storesState.stores}
            storesLoading={storesState.isLoading}
            employees={employeesState.employees}
            categories={categoriesState.categories}
            onViewStoreDetail={() => setActiveTab('store-detail')}
          />
        );
      case 'store-detail':
        return <StoreDetail storeId={storesState.stores[0]?.id ?? null} />;
      case 'employees':
        return (
          <Employees
            employees={employeesState.employees}
            setEmployees={employeesState.setEmployees}
            employeesLoading={employeesState.isLoading}
            employeesError={employeesState.error}
            onRetryEmployees={employeesState.reload}
          />
        );
      case 'categories':
        return (
          <Categories
            categories={categoriesState.categories}
            setCategories={categoriesState.setCategories}
            isLoading={categoriesState.isLoading}
            loadError={categoriesState.error}
            onRetry={categoriesState.reload}
          />
        );
      case 'tasks':
        return (
          <Tasks
            onNavigateToCategories={() => setActiveTab('categories')}
            categories={categoriesState.categories}
            categoriesLoading={categoriesState.isLoading}
            categoriesError={categoriesState.error}
            onRetryCategories={categoriesState.reload}
            stores={storesState.stores}
          />
        );
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
      avatarUrl={avatarUrl}
    >
      {overlay === 'profile' ? (
        <Profile initials={userInitials} avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} />
      ) : overlay === 'help' ? (
        <Help />
      ) : (
        renderActivePage()
      )}
    </AppShell>
  );
}

export default DashboardShell;
