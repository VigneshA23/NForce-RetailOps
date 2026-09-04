import { useMemo } from 'react';
import type { OwnerSummary } from '../types/owner';
import type { GroupedOwner } from './OwnerCard';
import OwnerCard from './OwnerCard';
import './OwnerList.css';

interface OwnerListProps {
  owners: OwnerSummary[];
  isLoading?: boolean;
  onToggleStatus: (owner: OwnerSummary) => void;
  onAddStore: (owner: OwnerSummary) => void;
  onToggleStoreStatus: (store: OwnerSummary) => void;
  onViewStoreChecklist: (store: OwnerSummary) => void;
}

function groupOwnersByStores(owners: OwnerSummary[]): GroupedOwner[] {
  const groups = new Map<number, GroupedOwner>();
  owners.forEach((owner) => {
    const existing = groups.get(owner.ownerId);
    if (existing) {
      existing.active = owner.ownerActive;
      if (owner.storeId != null) existing.stores.push(owner);
    } else {
      groups.set(owner.ownerId, {
        ownerId: owner.ownerId,
        ownerName: owner.ownerName,
        ownerEmail: owner.ownerEmail,
        active: owner.ownerActive,
        stores: owner.storeId != null ? [owner] : [],
      });
    }
  });
  return Array.from(groups.values());
}

function OwnerList({ owners, isLoading = false, onToggleStatus, onAddStore, onToggleStoreStatus, onViewStoreChecklist }: OwnerListProps) {
  const groupedOwners = useMemo(() => groupOwnersByStores(owners), [owners]);

  if (isLoading) {
    return <div className="owner-list__empty">Loading owners...</div>;
  }

  if (groupedOwners.length === 0) {
    return <div className="owner-list__empty">No owners yet. Add one to get started.</div>;
  }

  return (
    <div className="owner-list">
      {groupedOwners.map((owner) => (
        <OwnerCard
          key={owner.ownerId}
          owner={owner}
          onToggleStatus={onToggleStatus}
          onAddStore={onAddStore}
          onToggleStoreStatus={onToggleStoreStatus}
          onViewStoreChecklist={onViewStoreChecklist}
        />
      ))}
    </div>
  );
}

export default OwnerList;
