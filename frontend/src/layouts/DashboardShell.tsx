import { useMemo, useState } from 'react';
import type { NavTabKey } from '../types/navigation';
import { OWNER_NAV_ITEMS, PAGE_TITLES } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import type { MeResponse } from '../api/me';
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
import { useOwnerStores } from '../hooks/useOwnerStores';
import { useOwnerCategories } from '../hooks/useOwnerCategories';
import { useOwnerEmployees } from '../hooks/useOwnerEmployees';

interface DashboardShellProps {
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
  me: MeResponse | null;
  meLoading: boolean;
  meError: string | null;
  onMeUpdated: (me: MeResponse) => void;
}

type Overlay = 'profile' | 'help' | null;

function DashboardShell({ user, onLogout, loggingOut, me, meLoading, meError, onMeUpdated }: DashboardShellProps) {
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
          />
        );
      case 'store-management':
        return (
          <Stores
            stores={storesState.stores}
            setStores={storesState.setStores}
            isLoading={storesState.isLoading}
            loadError={storesState.error}
            onRetry={storesState.reload}
          />
        );
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
            storesLoading={storesState.isLoading}
            storesError={storesState.error}
            onRetryStores={storesState.reload}
          />
        );
      case 'history':
        return (
          <History
            stores={storesState.stores}
            storesLoading={storesState.isLoading}
            storesError={storesState.error}
            onRetryStores={storesState.reload}
          />
        );
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
    >
      {overlay === 'profile' ? (
        <Profile initials={userInitials} me={me} isLoading={meLoading} error={meError} onMeUpdated={onMeUpdated} />
      ) : overlay === 'help' ? (
        <Help />
      ) : (
        renderActivePage()
      )}
    </AppShell>
  );
}

export default DashboardShell;
