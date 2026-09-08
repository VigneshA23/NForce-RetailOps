import { Eye } from 'lucide-react';
import type { StoreOperationsSummary } from '../api/superAdminOperations';
import UserAvatar from './UserAvatar';
import { getInitials } from '../utils/initials';
import './StoreComparisonTable.css';

interface StoreComparisonTableProps {
  stores: StoreOperationsSummary[];
  isLoading: boolean;
  onStoreClick?: (storeId: number) => void;
  onViewDetail?: (store: StoreOperationsSummary) => void;
}

function completionTone(percent: number): string {
  if (percent >= 80) return 'good';
  if (percent >= 60) return 'warn';
  return 'bad';
}

function relativeTime(isoString: string | null): string {
  if (!isoString) return '—';
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function StoreComparisonTable({ stores, isLoading, onStoreClick, onViewDetail }: StoreComparisonTableProps) {
  if (isLoading) {
    return <div className="sct__loading">Loading stores…</div>;
  }

  if (stores.length === 0) {
    return <div className="sct__empty">No active stores found.</div>;
  }

  return (
    <div className="card sct">
      <table className="sct__table">
        <thead>
          <tr>
            <th className="sct__th">Store</th>
            <th className="sct__th">Owner</th>
            <th className="sct__th sct__th--center">Today's Completion</th>
            <th className="sct__th sct__th--center">Open Issues</th>
            <th className="sct__th sct__th--right">Last Activity</th>
            {onViewDetail && <th className="sct__th sct__th--center" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {stores.map((store) => {
            const tone = completionTone(store.completionPercent);
            return (
              <tr key={store.storeId} className="sct__row">
                <td className="sct__td sct__td--name" data-label="Store">
                  {onStoreClick ? (
                    <button
                      type="button"
                      className="sct__store-link"
                      onClick={() => onStoreClick(store.storeId)}
                    >
                      {store.storeName}
                    </button>
                  ) : (
                    store.storeName
                  )}
                </td>
                <td className="sct__td sct__td--owner" data-label="Owner">
                  <div className="sct__owner-cell">
                    <UserAvatar
                      initials={getInitials(store.ownerName)}
                      src={store.ownerAvatarUrl}
                      size={24}
                    />
                    <span>{store.ownerName}</span>
                  </div>
                </td>
                <td className="sct__td sct__td--center" data-label="Today's Completion">
                  <span className={`sct__badge sct__badge--${tone}`}>
                    {store.completionPercent}%
                  </span>
                </td>
                <td className="sct__td sct__td--center" data-label="Open Issues">
                  {store.openIssues > 0 ? (
                    <span className="sct__badge sct__badge--issue">{store.openIssues}</span>
                  ) : (
                    <span className="sct__none">—</span>
                  )}
                </td>
                <td className="sct__td sct__td--right sct__td--muted" data-label="Last Activity">
                  {relativeTime(store.lastActivityAt)}
                </td>
                {onViewDetail && (
                  <td className="sct__td sct__td--center" data-label="">
                    <button
                      type="button"
                      className="table-icon-btn"
                      aria-label={`View category detail for ${store.storeName}`}
                      title="View category detail"
                      onClick={() => onViewDetail(store)}
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default StoreComparisonTable;
