import { useEffect, useMemo, useState } from 'react';
<<<<<<< Updated upstream
import { Clock, LayoutGrid, Store, Tags, Users } from 'lucide-react';
=======
import { LayoutDashboard, Users } from 'lucide-react';
>>>>>>> Stashed changes
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import AdminDashboard from '../pages/AdminDashboard';
import Employees from '../pages/Employees';
<<<<<<< Updated upstream
import Categories from '../pages/Categories';
import Home from '../pages/Home';
import Stores from '../pages/Stores';
import History from '../pages/History';
import './DashboardShell.css';

const NAV_ITEMS: NavItem[] = [
  { key: 'home', label: 'Home', icon: LayoutGrid },
  { key: 'store-management', label: 'Stores', icon: Store },
  { key: 'employees', label: 'Employees', icon: Users },
  { key: 'categories', label: 'Categories', icon: Tags },
  { key: 'history', label: 'History', icon: Clock },
];

const PAGE_TITLES: Record<NavTabKey, string> = {
  home: 'Home',
  'store-management': 'Stores',
  employees: 'Employees',
  categories: 'Categories',
  history: 'History',
=======
import Profile from '../pages/Profile';
import Help from '../pages/Help';
import './DashboardShell.css';

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
  { key: 'employees', label: 'Employee Management', icon: Users },
];

const PAGE_TITLES: Record<NavTabKey, string> = {
  dashboard: 'Admin Dashboard',
  employees: 'Employee Management',
  profile: 'My Profile',
  help: 'Help & Guidance',
};

const ROLE_LABELS: Record<AuthUser['role'], string> = {
  OWNER_ADMIN: 'Owner/Admin',
  EMPLOYEE: 'Employee',
>>>>>>> Stashed changes
};

const THEME_STORAGE_KEY = 'nforce-retailops-theme';

function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
}

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface DashboardShellProps {
  user: AuthUser;
  onLogout: () => void;
}

function DashboardShell({ user, onLogout }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<NavTabKey>('dashboard');
  const [searchValue, setSearchValue] = useState('');
  const [isDarkTheme, setIsDarkTheme] = useState(getInitialTheme);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkTheme ? 'dark' : 'light';
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName]);

  function renderActivePage() {
    switch (activeTab) {
<<<<<<< Updated upstream
      case 'home':
        return <Home />;
      case 'store-management':
        return <Stores />;
      case 'employees':
        return <Employees />;
      case 'categories':
        return <Categories />;
      case 'history':
        return <History />;
=======
      case 'dashboard':
        return (
          <AdminDashboard
            token={user.token}
            fullName={user.fullName}
            onManageEmployees={() => setActiveTab('employees')}
          />
        );
      case 'employees':
        return <Employees token={user.token} />;
      case 'profile':
        return <Profile token={user.token} initials={userInitials} />;
      case 'help':
        return <Help />;
>>>>>>> Stashed changes
      default: {
        const _exhaustive: never = activeTab;
        return _exhaustive;
      }
    }
  }

  return (
    <div className="dashboard-shell">
      <div className="dashboard-shell__header">
        <Header
          title={PAGE_TITLES[activeTab]}
          searchValue={searchValue}
          onSearchChange={setSearchValue}
          isDarkTheme={isDarkTheme}
          onToggleTheme={() => setIsDarkTheme((current) => !current)}
          userInitials={userInitials}
          fullName={user.fullName}
          roleLabel={ROLE_LABELS[user.role]}
          onProfileClick={() => setActiveTab('profile')}
          onHelpClick={() => setActiveTab('help')}
          onSignOut={onLogout}
        />
      </div>
      <div className="dashboard-shell__body">
        <Sidebar
          items={NAV_ITEMS}
          activeTab={activeTab}
          onSelect={setActiveTab}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((current) => !current)}
        />
        <main className="dashboard-shell__main">{renderActivePage()}</main>
      </div>
    </div>
  );
}

export default DashboardShell;
