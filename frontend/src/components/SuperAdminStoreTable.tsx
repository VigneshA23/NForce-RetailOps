import { Eye, Pencil, Trash2, UserRoundCog } from 'lucide-react';
import type { SuperAdminStore } from '../types/superAdminStore';
import UserAvatar from './UserAvatar';
import { getInitials } from '../utils/initials';
import './SuperAdminStoreTable.css';

interface SuperAdminStoreTableProps {
  stores: SuperAdminStore[];
  isLoading?: boolean;
  emptyMessage?: string;
  onViewDetails: (store: SuperAdminStore) => void;
  onToggleStatus: (store: SuperAdminStore) => void;
  onEdit: (store: SuperAdminStore) => void;
  onAssignOwner: (store: SuperAdminStore) => void;
  onDelete: (store: SuperAdminStore) => void;
}

function SuperAdminStoreTable({
  stores,
  isLoading = false,
  emptyMessage = 'No stores match your filters.',
  onViewDetails,
  onToggleStatus,
  onEdit,
  onAssignOwner,
  onDelete,
}: SuperAdminStoreTableProps) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Store</th>
              <th scope="col">Owner</th>
              <th scope="col">Employees</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {stores.map((store) => (
              <tr key={store.storeId}>
                <td data-label="Store">
                  <button
                    type="button"
                    className="super-admin-store-table__name-link"
                    onClick={() => onViewDetails(store)}
                  >
                    <span className="super-admin-store-table__name">{store.storeName}</span>
                    <span className="super-admin-store-table__code">#{store.storeCode}</span>
                  </button>
                </td>
                <td data-label="Owner">
                  {store.ownerAccessActive && store.ownerName ? (
                    <div className="sa-store-table__owner-cell">
                      <UserAvatar
                        initials={getInitials(store.ownerName)}
                        src={store.ownerAvatarUrl}
                        size={28}
                      />
                      <span>{store.ownerName}</span>
                    </div>
                  ) : (
                    <span className="badge badge--outline">Unassigned</span>
                  )}
                </td>
                <td data-label="Employees">{store.employeeCount}</td>
                <td data-label="Status">
                  <label
                    className="status-toggle"
                    title={store.storeActive ? 'Deactivate store' : 'Activate store'}
                  >
                    <input
                      type="checkbox"
                      checked={store.storeActive}
                      onChange={() => onToggleStatus(store)}
                      aria-label={`${store.storeActive ? 'Deactivate' : 'Activate'} ${store.storeName}`}
                    />
                    <span className="status-toggle__track" aria-hidden="true">
                      <span className="status-toggle__thumb" />
                    </span>
                  </label>
                </td>
                <td className="table-actions-cell" data-label="Actions">
                  <div className="table-row-actions">
                    <button
                      type="button"
                      className="table-icon-btn"
                      aria-label={`View ${store.storeName}`}
                      title="View checklist"
                      onClick={() => onViewDetails(store)}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn"
                      aria-label={`Edit ${store.storeName}`}
                      title="Edit store"
                      onClick={() => onEdit(store)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn"
                      aria-label={`Assign owner to ${store.storeName}`}
                      title="Assign owner"
                      onClick={() => onAssignOwner(store)}
                    >
                      <UserRoundCog size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn--danger"
                      aria-label={`Delete ${store.storeName}`}
                      title="Delete store"
                      onClick={() => onDelete(store)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && stores.length === 0 && <div className="table-card__empty">{emptyMessage}</div>}
      {isLoading && <div className="table-card__empty">Loading stores...</div>}
    </div>
  );
}

export default SuperAdminStoreTable;
