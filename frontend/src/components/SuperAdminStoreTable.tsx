import { Eye, Pencil, Trash2, User, UserRoundCog, Users } from 'lucide-react';
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
    <div className="table-card super-admin-store-table">
      <div className="table-scroll super-admin-store-table__desktop">
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

      {/* Mobile-only: the table above is hidden below --mobile in favor of this card list. */}
      <div className="super-admin-store-table__mobile-cards">
        {stores.map((store) => {
          const hasOwner = store.ownerAccessActive && store.ownerName;
          return (
            <div className="sa-store-mobile-card" key={store.storeId}>
              <div className="sa-store-mobile-card__header">
                <button
                  type="button"
                  className="sa-store-mobile-card__name-link"
                  onClick={() => onViewDetails(store)}
                >
                  <span className="sa-store-mobile-card__name">{store.storeName}</span>
                  <span className="sa-store-mobile-card__code">#{store.storeCode}</span>
                </button>
                <label
                  className="status-toggle sa-store-mobile-card__status"
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
              </div>

              <div className="sa-store-mobile-card__staff-row">
                <span className="sa-store-mobile-card__staff-pill">
                  <Users size={12} aria-hidden="true" />
                  {store.employeeCount} Staff Member{store.employeeCount === 1 ? '' : 's'}
                </span>
                <div className="table-row-actions sa-store-mobile-card__actions">
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
                    className="table-icon-btn table-icon-btn--danger"
                    aria-label={`Delete ${store.storeName}`}
                    title="Delete store"
                    onClick={() => onDelete(store)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="sa-store-mobile-card__owner-row">
                <div className="sa-store-mobile-card__owner-info">
                  {hasOwner ? (
                    <UserAvatar initials={getInitials(store.ownerName!)} src={store.ownerAvatarUrl} size={36} />
                  ) : (
                    <span className="sa-store-mobile-card__owner-placeholder" aria-hidden="true">
                      <User size={18} />
                    </span>
                  )}
                  <span className="sa-store-mobile-card__owner-text">
                    <span className="sa-store-mobile-card__owner-label">Owner</span>
                    <span
                      className={`sa-store-mobile-card__owner-name${hasOwner ? '' : ' sa-store-mobile-card__owner-name--unassigned'}`}
                    >
                      {hasOwner ? store.ownerName : 'Unassigned'}
                    </span>
                  </span>
                </div>
                <button
                  type="button"
                  className="table-icon-btn sa-store-mobile-card__assign-btn"
                  aria-label={`Assign owner to ${store.storeName}`}
                  title="Assign owner"
                  onClick={() => onAssignOwner(store)}
                >
                  <UserRoundCog size={16} />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && stores.length === 0 && <div className="table-card__empty">{emptyMessage}</div>}
      {isLoading && <div className="table-card__empty">Loading stores...</div>}
    </div>
  );
}

export default SuperAdminStoreTable;
