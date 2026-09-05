import { Pencil, Store as StoreIcon, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { OwnerSummary } from '../types/owner';
import './OwnerTable.css';

export interface GroupedOwner {
  ownerId: number;
  ownerName: string;
  ownerEmail: string;
  ownerActive: boolean;
  activeStore: OwnerSummary | null;
  anyStore: OwnerSummary | null;
}

function groupOwners(owners: OwnerSummary[]): GroupedOwner[] {
  const groups = new Map<number, GroupedOwner>();
  owners.forEach((row) => {
    const existing = groups.get(row.ownerId);
    if (existing) {
      existing.ownerActive = row.ownerActive;
      if (row.storeId != null) {
        if (row.storeActive) existing.activeStore = row;
        if (existing.anyStore == null) existing.anyStore = row;
      }
    } else {
      groups.set(row.ownerId, {
        ownerId: row.ownerId,
        ownerName: row.ownerName,
        ownerEmail: row.ownerEmail,
        ownerActive: row.ownerActive,
        activeStore: row.storeId != null && row.storeActive ? row : null,
        anyStore: row.storeId != null ? row : null,
      });
    }
  });
  return Array.from(groups.values());
}

interface OwnerTableProps {
  owners: OwnerSummary[];
  isLoading?: boolean;
  emptyMessage?: string;
  onEdit: (owner: GroupedOwner) => void;
  onToggleStatus: (owner: GroupedOwner) => void;
  onDeactivate: (owner: GroupedOwner) => void;
  onAddStore: (owner: GroupedOwner) => void;
  onViewChecklist: (store: OwnerSummary) => void;
}

function OwnerTable({
  owners,
  isLoading = false,
  emptyMessage = 'No owners match your filters.',
  onEdit,
  onToggleStatus,
  onDeactivate,
  onAddStore,
  onViewChecklist,
}: OwnerTableProps) {
  const grouped = useMemo(() => groupOwners(owners), [owners]);

  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Name</th>
              <th scope="col">Email</th>
              <th scope="col">Assigned Store</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {grouped.map((owner) => (
              <tr key={owner.ownerId}>
                <td data-label="ID">
                  <span className="owner-table__id">#{owner.ownerId}</span>
                </td>
                <td className="owner-table__name" data-label="Name">
                  {owner.ownerName}
                </td>
                <td data-label="Email">
                  <span className="owner-table__email">{owner.ownerEmail}</span>
                </td>
                <td data-label="Assigned Store">
                  {owner.activeStore ? (
                    <span className="owner-table__store">
                      <StoreIcon size={13} aria-hidden="true" />
                      {owner.activeStore.storeName}
                    </span>
                  ) : owner.anyStore ? (
                    <span className="owner-table__store owner-table__store--inactive">
                      <StoreIcon size={13} aria-hidden="true" />
                      {owner.anyStore.storeName}
                      <span className="badge badge--outline">Inactive</span>
                    </span>
                  ) : (
                    <span className="owner-table__no-store">No store assigned</span>
                  )}
                </td>
                <td data-label="Status">
                  <label
                    className="status-toggle"
                    title={owner.ownerActive ? 'Deactivate owner' : 'Activate owner'}
                  >
                    <input
                      type="checkbox"
                      checked={owner.ownerActive}
                      onChange={() => onToggleStatus(owner)}
                      aria-label={`${owner.ownerActive ? 'Deactivate' : 'Activate'} ${owner.ownerName}`}
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
                      aria-label={`Edit ${owner.ownerName}`}
                      title="Edit owner"
                      onClick={() => onEdit(owner)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn--danger"
                      aria-label={`Deactivate ${owner.ownerName}`}
                      title={owner.ownerActive ? 'Deactivate owner' : 'Owner already inactive'}
                      disabled={!owner.ownerActive}
                      onClick={() => onDeactivate(owner)}
                    >
                      <Trash2 size={16} />
                    </button>
                    {!owner.activeStore && (
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn--text"
                        aria-label={`Add store for ${owner.ownerName}`}
                        title="Add store"
                        onClick={() => onAddStore(owner)}
                      >
                        <StoreIcon size={14} />
                        <span>Add Store</span>
                      </button>
                    )}
                    {owner.activeStore && (
                      <button
                        type="button"
                        className="table-icon-btn table-icon-btn--text"
                        aria-label={`View checklist for ${owner.activeStore.storeName ?? owner.ownerName}`}
                        onClick={() => onViewChecklist(owner.activeStore!)}
                      >
                        View
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && grouped.length === 0 && (
        <div className="table-card__empty">{emptyMessage}</div>
      )}
      {isLoading && <div className="table-card__empty">Loading owners...</div>}
    </div>
  );
}

export default OwnerTable;
