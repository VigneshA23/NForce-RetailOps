import { useEffect, useState } from 'react';
import { Store as StoreIcon, Users } from 'lucide-react';
import { getDashboardSummary, type DashboardSummary } from '../api/dashboard';
import './AdminDashboard.css';

interface AdminDashboardProps {
  fullName: string;
  onManageEmployees: () => void;
}

function AdminDashboard({ fullName, onManageEmployees }: AdminDashboardProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getDashboardSummary()
      .then((data) => {
        if (isMounted) setSummary(data);
      })
      .catch(() => {
        if (isMounted) setError('Unable to load dashboard data. Please refresh the page.');
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard__intro">
        <h2 className="admin-dashboard__heading">Welcome back, {fullName.split(' ')[0]}</h2>
        <p className="admin-dashboard__subheading">
          Here&apos;s a snapshot of your stores and team right now.
        </p>
      </div>

      {error && <div className="admin-dashboard__error">{error}</div>}

      {!error && (
        <>
          <div className="admin-dashboard__stats">
            <div className="stat-card">
              <span className="stat-card__value">{isLoading ? '—' : summary?.totalStores ?? 0}</span>
              <span className="stat-card__label">Stores</span>
            </div>
            <div className="stat-card">
              <span className="stat-card__value">{isLoading ? '—' : summary?.totalEmployees ?? 0}</span>
              <span className="stat-card__label">Total Employees</span>
            </div>
          </div>

          <div className="admin-dashboard__stores-header">
            <h3>Your Stores</h3>
          </div>

          <div className="admin-dashboard__stores">
            {isLoading && <div className="admin-dashboard__empty">Loading stores...</div>}

            {!isLoading && summary?.stores.length === 0 && (
              <div className="admin-dashboard__empty">
                No stores are assigned to your account yet.
              </div>
            )}

            {!isLoading &&
              summary?.stores.map((store) => (
                <div className="store-card" key={store.id}>
                  <div className="store-card__header">
                    <div className="store-card__icon">
                      <StoreIcon size={18} />
                    </div>
                    <div>
                      <div className="store-card__name">{store.name}</div>
                    </div>
                    <span className={`badge ${store.active ? 'badge--success' : 'badge--danger'}`}>
                      {store.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="store-card__footer">
                    <span className="store-card__employee-count">
                      <Users size={14} />
                      {store.employeeCount} employee{store.employeeCount === 1 ? '' : 's'}
                    </span>
                    <button type="button" className="btn btn--secondary" onClick={onManageEmployees}>
                      Manage Employees
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

export default AdminDashboard;
