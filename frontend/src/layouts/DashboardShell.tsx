import { useMemo, useState } from 'react';
import { Clock, LayoutDashboard, Store, Tags, Users } from 'lucide-react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import AdminDashboard from '../pages/AdminDashboard';
import Employees from '../pages/Employees';
import Stores from '../pages/Stores';
import Categories from '../pages/Categories';
import History from '../pages/History';
import Profile from '../pages/Profile';
import Help from '../pages/Help';
import { useTheme } from '../hooks/useTheme';
import './DashboardShell.css';

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Admin Dashboard', icon: LayoutDashboard },
  { key: 'store-management', label: 'Stores', icon: Store },
  { key: 'employees', label: 'Employee Management', icon: Users },
  { key: 'categories', label: 'Categories', icon: Tags },
  { key: 'history', label: 'History', icon: Clock },
];

const PAGE_TITLES: Record<NavTabKey, string> = {
  dashboard: 'Admin Dashboard',
  'store-management': 'Stores',
  employees: 'Employee Management',
  categories: 'Categories',
  history: 'History',
  profile: 'My Profile',
  help: 'Help & Guidance',
};

function getInitials(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface DashboardShellProps {
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
}

function DashboardShell({ user, onLogout, loggingOut }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<NavTabKey>('dashboard');
  const [searchValue, setSearchValue] = useState('');
  const { isDarkTheme, toggleTheme } = useTheme();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  const userInitials = useMemo(() => getInitials(user.fullName), [user.fullName]);

  function renderActivePage() {
    switch (activeTab) {
      case 'dashboard':
        return (
          <AdminDashboard fullName={user.fullName} onManageEmployees={() => setActiveTab('employees')} />
        );
      case 'store-management':
        return <Stores />;
      case 'employees':
        return <Employees />;
      case 'categories':
        return <Categories />;
      case 'history':
        return <History />;
      case 'profile':
        return <Profile initials={userInitials} />;
      case 'help':
        return <Help />;
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
          onToggleTheme={toggleTheme}
          userName={user.fullName}
          onProfileClick={() => setActiveTab('profile')}
          onHelpClick={() => setActiveTab('help')}
          onLogout={onLogout}
          loggingOut={loggingOut}
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
