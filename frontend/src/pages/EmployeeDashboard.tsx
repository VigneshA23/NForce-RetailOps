import { useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import type { AuthUser } from '../types/auth';
import type { StoreSummary } from '../types/store';
import type { NavTabKey } from '../types/navigation';
import { EMPLOYEE_NAV_ITEMS, PAGE_TITLES } from '../types/navigation';
import AppShell from '../layouts/AppShell';
import PlaceholderPage from '../components/PlaceholderPage';
import History from './History';
import Settings from './Settings';

interface EmployeeDashboardProps {
  user: AuthUser;
  store: StoreSummary;
}

function EmployeeDashboard({ user, store }: EmployeeDashboardProps) {
  const [activeTab, setActiveTab] = useState<NavTabKey>('home');

  function renderActivePage() {
    switch (activeTab) {
      case 'home':
        return (
          <PlaceholderPage
            title={`Welcome, ${user.fullName}`}
            message={`Employee daily checklist for ${store.name} goes here.`}
            icon={LayoutGrid}
          />
        );
      case 'history':
        return <History />;
      case 'settings':
        return <Settings />;
      default:
        return null;
    }
  }

  return (
    <AppShell
      navItems={EMPLOYEE_NAV_ITEMS}
      activeTab={activeTab}
      onSelectTab={setActiveTab}
      title={PAGE_TITLES[activeTab]}
      user={user}
    >
      {renderActivePage()}
    </AppShell>
  );
}

export default EmployeeDashboard;
