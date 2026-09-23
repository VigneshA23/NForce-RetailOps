import { Copy, Eye, Mail, Pencil, Store as StoreIcon, Trash2 } from 'lucide-react';
import { useMemo } from 'react';
import type { OwnerSummary } from '../types/owner';
import { nfToast } from '../utils/toast';
import UserAvatar from './UserAvatar';
import { getInitials } from '../utils/initials';
import './OwnerTable.css';

async function copyEmail(email: string) {
  try {
    await navigator.clipboard.writeText(email);
    nfToast.success('Email copied to clipboard.');
  } catch {
    nfToast.error('Could not copy the email. Please copy it manually.');
  }
}

export interface GroupedOwner {
  ownerId: number;
  adminCode: string;
  ownerName: string;
  ownerEmail: string;
  ownerActive: boolean;
  avatarUrl?: string | null;
  activeStore: OwnerSummary | null;
  anyStore: OwnerSummary | null;
}

export function groupOwners(owners: OwnerSummary[]): GroupedOwner[] {
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
        adminCode: row.adminCode,
        ownerName: row.ownerName,
        ownerEmail: row.ownerEmail,
        ownerActive: row.ownerActive,
        avatarUrl: row.avatarUrl,
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
  onDelete: (owner: GroupedOwner) => void;
  onAddStore: (owner: GroupedOwner) => void;
  onView: (owner: GroupedOwner) => void;
}

function OwnerTable({
  owners,
  isLoading = false,
  emptyMessage = 'No owners match your filters.',
  onEdit,
  onToggleStatus,
  onDelete,
  onAddStore,
  onView,
}: OwnerTableProps) {
  const grouped = useMemo(() => groupOwners(owners), [owners]);

  return (
    <div className="table-card owner-table-card">
      <div className="table-scroll owner-table__desktop">
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
                  <span className="owner-table__id">{owner.adminCode}</span>
                </td>
                <td className="owner-table__name" data-label="Name">
                  <div className="owner-table__name-cell">
                    <UserAvatar
                      initials={getInitials(owner.ownerName)}
                      src={owner.avatarUrl}
                      size={32}
                    />
                    <span>{owner.ownerName}</span>
                  </div>
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
                  ) : owner.ownerActive && owner.anyStore ? (
                    // Only surfaced while the owner is active -- a deactivated
                    // owner's revoked store link (see setOwnerActive) isn't a
                    // manual per-store toggle worth flagging here, just noise.
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
                      aria-label={`View details for ${owner.ownerName}`}
                      title="View details"
                      onClick={() => onView(owner)}
                    >
                      <Eye size={16} />
                    </button>
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
                      aria-label={`Delete ${owner.ownerName}`}
                      title="Delete owner permanently"
                      onClick={() => onDelete(owner)}
                    >
                      <Trash2 size={16} />
                    </button>
                    {owner.ownerActive && !owner.activeStore && (
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
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile-only: the table above is hidden below --mobile in favor of this card list. */}
      <div className="owner-table__mobile-cards">
        {grouped.map((owner) => {
          const storeToShow = owner.activeStore ?? (owner.ownerActive ? owner.anyStore : null);
          return (
            <div className="owner-mobile-card" key={owner.ownerId}>
              <div className="owner-mobile-card__grid">
                <span className="owner-mobile-card__avatar">
                  <UserAvatar initials={getInitials(owner.ownerName)} src={owner.avatarUrl} size={44} />
                  <span
                    className={`owner-mobile-card__avatar-dot ${owner.ownerActive ? 'owner-mobile-card__avatar-dot--active' : 'owner-mobile-card__avatar-dot--inactive'}`}
                    aria-hidden="true"
                  />
                </span>
                <div className="owner-mobile-card__identity">
                  <span className="owner-mobile-card__name">{owner.ownerName}</span>
                  <span className="owner-mobile-card__id">{owner.adminCode}</span>
                </div>
                <label
                  className="status-toggle owner-mobile-card__status"
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

                <div className="owner-mobile-card__row owner-mobile-card__email">
                  <Mail size={14} aria-hidden="true" />
                  <a href={`mailto:${owner.ownerEmail}`} className="owner-mobile-card__email-link">
                    {owner.ownerEmail}
                  </a>
                  <button
                    type="button"
                    className="owner-mobile-card__copy-btn"
                    aria-label={`Copy ${owner.ownerName}'s email`}
                    title="Copy email"
                    onClick={() => copyEmail(owner.ownerEmail)}
                  >
                    <Copy size={14} />
                  </button>
                </div>

                <div className="owner-mobile-card__store-block">
                  <span className="owner-mobile-card__store-label">Assigned Store</span>
                  <div className="owner-mobile-card__store-row">
                    {storeToShow ? (
                      <span className="owner-mobile-card__store-pill">
                        <StoreIcon size={12} aria-hidden="true" />
                        {storeToShow.storeName}
                        {!owner.activeStore && (
                          <span className="badge badge--outline">Inactive</span>
                        )}
                      </span>
                    ) : (
                      <span className="owner-table__no-store">No store assigned</span>
                    )}

                    <div className="owner-mobile-card__icon-actions">
                      <button
                        type="button"
                        className="owner-mobile-card__icon-btn"
                        aria-label={`View details for ${owner.ownerName}`}
                        title="View details"
                        onClick={() => onView(owner)}
                      >
                        <Eye size={16} />
                      </button>
                      <button
                        type="button"
                        className="owner-mobile-card__icon-btn"
                        aria-label={`Edit ${owner.ownerName}`}
                        title="Edit owner"
                        onClick={() => onEdit(owner)}
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="owner-mobile-card__icon-btn"
                        aria-label={`Delete ${owner.ownerName}`}
                        title="Delete owner permanently"
                        onClick={() => onDelete(owner)}
                      >
                        <Trash2 size={16} />
                      </button>
                      {owner.ownerActive && !owner.activeStore && (
                        <button
                          type="button"
                          className="owner-mobile-card__icon-btn"
                          aria-label={`Add store for ${owner.ownerName}`}
                          title="Add store"
                          onClick={() => onAddStore(owner)}
                        >
                          <StoreIcon size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && grouped.length === 0 && (
        <div className="table-card__empty">{emptyMessage}</div>
      )}
      {isLoading && <div className="table-card__empty">Loading owners...</div>}
    </div>
  );
}

export default OwnerTable;
