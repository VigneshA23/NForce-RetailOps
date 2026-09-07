import { useMemo, useState } from 'react';
import type { NavTabKey } from '../types/navigation';
import { OWNER_BOTTOM_NAV_ITEMS, OWNER_NAV_ITEMS, PAGE_TITLES } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import AppShell from './AppShell';
import Employees from '../pages/Employees';
import Categories from '../pages/Categories';
import Home from '../pages/Home';
import StoreDetail from '../pages/StoreDetail';
import Tasks from '../pages/Tasks';
import Profile from '../pages/Profile';
import Help from '../pages/Help';
import Settings from '../pages/Settings';
import Notifications from '../pages/Notifications';
import { getInitials } from '../utils/initials';
import { useOwnerStores } from '../hooks/useOwnerStores';
import { useOwnerCategories } from '../hooks/useOwnerCategories';
import { useOwnerEmployees } from '../hooks/useOwnerEmployees';
import { useUnreadCount } from '../hooks/useUnreadCount';
import AdminSearchDropdown from '../components/AdminSearchDropdown';

interface DashboardShellProps {
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
  avatarUrl?: string | null;
  onAvatarChange?: (url: string | null) => void;
}

type Overlay = 'profile' | 'help' | 'settings' | 'notifications' | null;

function DashboardShell({ user, onLogout, loggingOut, avatarUrl, onAvatarChange }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<NavTabKey>('home');
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [searchSeed, setSearchSeed] = useState<{ term: string; id: number } | undefined>(undefined);

  // Fetched once here (not per-page) and shared as props, so switching tabs
  // never re-fetches data that hasn't changed. See useAssignedStores.ts for
  // the equivalent pattern already used on the employee side.
  const storesState = useOwnerStores();
  const categoriesState = useOwnerCategories();
  const employeesState = useOwnerEmployees();
  const { count: unreadCount, setCount } = useUnreadCount();

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName]);

  const title = overlay === 'profile' ? 'My Profile'
    : overlay === 'help' ? 'Help & Guidance'
    : overlay === 'settings' ? 'Settings'
    : PAGE_TITLES[activeTab];

  function handleNotificationsCountChange(value: number) {
    if (value === 0) setCount(0);
    else setCount((prev) => Math.max(0, prev + value));
  }

  function handleNotificationNavigate(path: string) {
    switch (path) {
      case '/home': setActiveTab('home'); setOverlay(null); break;
      case '/store-detail': setActiveTab('store-detail'); setOverlay(null); break;
      case '/employees': setActiveTab('employees'); setOverlay(null); break;
      case '/tasks': setActiveTab('tasks'); setOverlay(null); break;
      default: setOverlay('notifications'); break;
    }
  }

  function handleSearchNavigate(group: 'tasks' | 'categories' | 'employees', term: string) {
    setOverlay(null);
    setSearchSeed({ term, id: Date.now() });
    if (group === 'tasks') setActiveTab('tasks');
    else if (group === 'categories') setActiveTab('categories');
    else if (group === 'employees') setActiveTab('employees');
  }

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
            searchSeed={searchSeed}
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
            searchSeed={searchSeed}
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
            searchSeed={searchSeed}
          />
        );
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
      subtitle={storesState.stores[0]?.name}
      contentKey={overlay ?? activeTab}
      logoSrc="/nforce-logo.png"
      hideLogoOnDesktop
      user={user}
      onLogout={onLogout}
      loggingOut={loggingOut}
      onProfileClick={() => setOverlay('profile')}
      onHelpClick={() => setOverlay('help')}
      onSettingsClick={() => setOverlay('settings')}
      onNotificationsClick={() => setOverlay('notifications')}
      onNotificationNavigate={handleNotificationNavigate}
      notificationUnreadCount={unreadCount}
      onNotificationsCountChange={handleNotificationsCountChange}
      avatarUrl={avatarUrl}
      mobileNav="bottom-tabs"
      bottomNavItems={OWNER_BOTTOM_NAV_ITEMS}
      showSearch={false}
      headerActions={<AdminSearchDropdown onNavigate={handleSearchNavigate} />}
    >
      {overlay === 'profile' ? (
        <Profile initials={userInitials} avatarUrl={avatarUrl} onAvatarChange={onAvatarChange} />
      ) : overlay === 'help' ? (
        <Help />
      ) : overlay === 'settings' ? (
        <Settings />
      ) : overlay === 'notifications' ? (
        <Notifications onUnreadChange={handleNotificationsCountChange} onNavigate={handleNotificationNavigate} />
      ) : (
        renderActivePage()
      )}
    </AppShell>
  );
}

export default DashboardShell;
