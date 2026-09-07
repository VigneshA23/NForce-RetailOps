import { useEffect, useState, type FormEvent } from 'react';
import type { OwnerSummary } from '../types/owner';
import type { SuperAdminStore } from '../types/superAdminStore';
import Modal from './Modal';

interface AssignStoreOwnerModalProps {
  store: SuperAdminStore | null;
  availableOwners: OwnerSummary[];
  isSubmitting?: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onSubmit: (ownerId: number) => void;
}

function AssignStoreOwnerModal({
  store,
  availableOwners,
  isSubmitting = false,
  errorMessage,
  onClose,
  onSubmit,
}: AssignStoreOwnerModalProps) {
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>('');

  useEffect(() => {
    if (store) setSelectedOwnerId('');
  }, [store]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!selectedOwnerId) return;
    onSubmit(Number(selectedOwnerId));
  }

  const hasOwners = availableOwners.length > 0;

  return (
    <Modal
      isOpen={store !== null}
      onClose={onClose}
      title="Assign Owner"
      subtitle={store?.storeName}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            type="submit"
            form="assign-owner-form"
            className="btn btn--primary"
            disabled={isSubmitting || !selectedOwnerId || !hasOwners}
          >
            {isSubmitting ? 'Saving…' : 'Assign Owner'}
          </button>
        </>
      }
    >
      <form id="assign-owner-form" onSubmit={handleSubmit}>
        {!hasOwners ? (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            No owners available to assign — all current owners already manage a store.
          </p>
        ) : (
          <div className="form-field">
            <label className="form-label" htmlFor="assign-owner-select">
              Select Owner
            </label>
            <select
              id="assign-owner-select"
              className="select"
              value={selectedOwnerId}
              onChange={(e) => setSelectedOwnerId(e.target.value)}
              required
            >
              <option value="">Choose an owner…</option>
              {availableOwners.map((owner) => (
                <option key={owner.ownerId} value={String(owner.ownerId)}>
                  {owner.adminCode} — {owner.ownerName}
                </option>
              ))}
            </select>
          </div>
        )}

        {errorMessage && (
          <p style={{ fontSize: '0.875rem', color: 'var(--color-accent)', marginTop: '0.5rem' }}>
            {errorMessage}
          </p>
        )}
      </form>
    </Modal>
  );
}

export default AssignStoreOwnerModal;
