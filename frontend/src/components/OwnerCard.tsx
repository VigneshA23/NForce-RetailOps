import { Store } from 'lucide-react';
import type { OwnerSummary } from '../types/owner';
import Toggle from './Toggle';
import './OwnerCard.css';

export interface GroupedOwner {
  ownerId: number;
  ownerName: string;
  ownerEmail: string;
  active: boolean;
  stores: OwnerSummary[];
}

interface OwnerCardProps {
  owner: GroupedOwner;
  onToggleStatus: (owner: OwnerSummary) => void;
  onAddStore: (owner: OwnerSummary) => void;
  onToggleStoreStatus: (store: OwnerSummary) => void;
  onViewStoreChecklist: (store: OwnerSummary) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function OwnerCard({ owner, onToggleStatus, onAddStore, onToggleStoreStatus, onViewStoreChecklist }: OwnerCardProps) {
  const hasActiveStore = owner.stores.some((s) => s.storeActive === true);
  const representative: OwnerSummary = owner.stores[0] ?? {
    ownerId: owner.ownerId,
    ownerName: owner.ownerName,
    ownerEmail: owner.ownerEmail,
    ownerActive: owner.active,
    storeId: null,
    storeCode: null,
    storeName: null,
    storeLocation: null,
    storeActive: null,
  };

  return (
    <div className="owner-card">
      <div className="owner-card__header">
        <div className="owner-card__identity">
          <span className="owner-card__avatar" aria-hidden="true">
            {getInitials(owner.ownerName)}
          </span>
          <div className="owner-card__info">
            <div className="owner-card__name-row">
              <h3 className="owner-card__name">{owner.ownerName}</h3>
              <span className={`badge ${owner.active ? 'badge--solid' : 'badge--outline'}`}>
                {owner.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <a className="owner-card__email" href={`mailto:${owner.ownerEmail}`}>
              {owner.ownerEmail}
            </a>
          </div>
        </div>

        <div className="owner-card__actions">
          <button
            type="button"
            className="btn btn--dark owner-card__action-btn"
            onClick={() => onAddStore(representative)}
            disabled={hasActiveStore}
            title={hasActiveStore ? 'This owner already has an active store' : undefined}
          >
            Add Store
          </button>
          <button
            type="button"
            className={`btn owner-card__action-btn ${owner.active ? 'btn--danger' : 'btn--secondary'}`}
            onClick={() => onToggleStatus(representative)}
          >
            {owner.active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      </div>

      <div className="owner-card__stores">
        <span className="owner-card__stores-label">
          {owner.stores.length} {owner.stores.length === 1 ? 'Store' : 'Stores'}
        </span>
        <div className="owner-card__stores-list">
          {owner.stores.length === 0 && <p className="owner-card__stores-empty">No stores yet.</p>}
          {owner.stores.map((store) => (
            <div className={`store-row ${store.storeActive ? '' : 'store-row--inactive'}`} key={store.storeId}>
              <div className="store-row__info">
                <Store size={16} className="store-row__icon" aria-hidden="true" />
                <div className="store-row__text">
                  <span className="store-row__name-line">
                    <span className="store-row__name">{store.storeName}</span>
                    <span className="store-row__code">#{store.storeCode}</span>
                  </span>
                  <span className="store-row__location">{store.storeLocation}</span>
                </div>
              </div>
              <div className="store-row__meta">
                {store.storeActive && (
                  <button
                    type="button"
                    className="btn btn--secondary owner-card__action-btn"
                    onClick={() => onViewStoreChecklist(store)}
                  >
                    View Checklist
                  </button>
                )}
                <Toggle
                  checked={store.storeActive ?? false}
                  onChange={() => onToggleStoreStatus(store)}
                  label={`${store.storeActive ? 'Deactivate' : 'Activate'} ${store.storeName ?? 'store'}`}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default OwnerCard;
