import { useEffect, useMemo, useState } from 'react';
import { Clock, LayoutGrid, Store, Tags, Users } from 'lucide-react';
import type { NavItem, NavTabKey } from '../types/navigation';
import type { AuthUser } from '../types/auth';
import Header from '../components/Header';
import Dock, { type DockItemData } from '../components/Dock';
import Employees from '../pages/Employees';
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
};

const THEME_STORAGE_KEY = 'nforce-retailops-theme';

function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
}

interface DashboardShellProps {
  user: AuthUser;
  onLogout: () => void;
  loggingOut?: boolean;
}

function DashboardShell({ user, onLogout, loggingOut }: DashboardShellProps) {
  const [activeTab, setActiveTab] = useState<NavTabKey>('employees');
  const [searchValue, setSearchValue] = useState('');
  const [isDarkTheme, setIsDarkTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkTheme ? 'dark' : 'light';
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  const dockItems: DockItemData[] = useMemo(
    () =>
      NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        return {
          icon: <Icon size={18} />,
          label: item.label,
          onClick: () => setActiveTab(item.key),
          className: item.key === activeTab ? 'dock-item--active' : undefined,
        };
      }),
    [activeTab],
  );

  function renderActivePage() {
    switch (activeTab) {
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
          userName={user.fullName}
          onLogout={onLogout}
          loggingOut={loggingOut}
        />
      </div>
      <main className="dashboard-shell__main">{renderActivePage()}</main>
      <div className="dashboard-shell__nav">
        <Dock items={dockItems} panelHeight={68} baseItemSize={50} magnification={70} />
      </div>
    </div>
  );
}

export default DashboardShell;
