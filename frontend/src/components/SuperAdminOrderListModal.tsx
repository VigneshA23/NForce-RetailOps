import { useEffect, useState } from 'react';
import { getOrderListForStore, updateSuperAdminOrderStatus } from '../api/superAdminOperations';
import type { OrderListEntry, OrderStatus } from '../types/orderList';
import { STATUS_META, STATUS_ORDER } from '../utils/orderListStatus';
import { nfToast } from '../utils/toast';
import Modal from './Modal';
import StatusDotMenu from './StatusDotMenu';

interface SuperAdminOrderListModalProps {
  // Non-null opens the modal; null closes it. Passing both id and name avoids
  // a second round trip just to render the modal's title.
  store: { storeId: number; storeName: string } | null;
  onClose: () => void;
  // Called after a status change succeeds, so the Home tab's outstanding-count
  // cards can refetch and stay in sync without a full page reload.
  onStatusChanged?: () => void;
}

const STATUS_OPTIONS = STATUS_ORDER.map((key) => ({ value: key, label: STATUS_META[key].label, dot: STATUS_META[key].fg }));

function SuperAdminOrderListModal({ store, onClose, onStatusChanged }: SuperAdminOrderListModalProps) {
  const [entries, setEntries] = useState<OrderListEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  function load() {
    if (!store) return;
    setIsLoading(true);
    setLoadError(null);
    getOrderListForStore(store.storeId)
      .then(setEntries)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (store) load();
    else setEntries([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.storeId]);

  async function handleStatusChange(entry: OrderListEntry, nextStatus: OrderStatus) {
    if (!store) return;
    try {
      const updated = await updateSuperAdminOrderStatus(store.storeId, entry.id, nextStatus);
      setEntries((current) => current.map((e) => (e.id === updated.id ? updated : e)));
      nfToast.success(`"${updated.itemName}" marked as ${STATUS_META[nextStatus].label.toLowerCase()}.`);
      onStatusChanged?.();
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Failed to update order status');
    }
  }

  return (
    <Modal
      isOpen={store !== null}
      onClose={onClose}
      title={store?.storeName ?? ''}
      subtitle="Order list"
      footer={
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      {isLoading && <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Loading…</p>}
      {loadError && <p style={{ fontSize: '0.875rem', color: 'var(--color-accent)' }}>{loadError}</p>}
      {!isLoading && !loadError && entries.length === 0 && (
        <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>No order-list entries for this store.</p>
      )}
      {!isLoading && !loadError && entries.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {entries.map((entry) => (
            <div
              key={entry.id}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem',
                padding: '0.5rem 0', borderBottom: '1px solid var(--color-border)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{entry.itemName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                  {entry.quantityNeeded} {entry.unitOfMeasurement}
                  {entry.supplierName ? ` · ${entry.supplierName}` : ''}
                </div>
              </div>
              <StatusDotMenu
                options={STATUS_OPTIONS}
                value={entry.status}
                onChange={(value) => handleStatusChange(entry, value as OrderStatus)}
                ariaLabel={`Change status for ${entry.itemName}`}
              />
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

export default SuperAdminOrderListModal;
