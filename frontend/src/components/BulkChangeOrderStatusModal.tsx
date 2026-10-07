import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Modal from './Modal';
import ButtonDots from './ButtonDots';
import CategoryIcon from './CategoryIcon';
import { STATUS_META } from '../utils/orderListStatus';
import type { OrderStatus } from '../types/orderList';
import type { InventoryItemCategory } from '../types/storeInventory';
import './BulkChangeOrderStatusModal.css';

export interface BulkStatusChangeItem {
  id: number;
  itemName: string;
  quantityLabel: string;
  meta: string;
  category: InventoryItemCategory | null;
  imageId: number | null;
}

interface BulkChangeOrderStatusModalProps {
  nextStatus: OrderStatus;
  eligibleItems: BulkStatusChangeItem[];
  skippedCount: number;
  // May return a Promise -- same loading-dots/disable-while-pending contract
  // as ConfirmDialog/ChangeOrderStatusModal's onConfirm.
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

// Only NEEDS_ORDERING -> ORDERED and ORDERED -> RECEIVED are reachable from
// the bulk action buttons (see OrderList.tsx's requestBulkStatusChange),
// matching the backend's one-step-forward ALLOWED_TRANSITIONS -- the "from"
// side is therefore always implied by the target, never passed in.
const FROM_STATUS: Record<OrderStatus, OrderStatus> = {
  NEEDS_ORDERING: 'NEEDS_ORDERING',
  ORDERED: 'NEEDS_ORDERING',
  RECEIVED: 'ORDERED',
};

function StatusPill({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="bulk-change-order-status-modal__pill" style={{ background: meta.bg, color: meta.fg }}>
      <span className="bulk-change-order-status-modal__pill-dot" style={{ background: meta.fg }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

// Bulk sibling of ChangeOrderStatusModal -- confirms the selection-based
// "Mark ordered"/"Mark received" action bar buttons the same way the per-row
// dropdown is confirmed, but also has to account for a selection that mixes
// eligible and ineligible items (only one step forward is ever allowed, so a
// row already past the target status is skipped rather than failing the
// whole batch).
function BulkChangeOrderStatusModal({ nextStatus, eligibleItems, skippedCount, onConfirm, onCancel }: BulkChangeOrderStatusModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const fromStatus = FROM_STATUS[nextStatus];
  const verb = STATUS_META[nextStatus].label.toLowerCase();
  const count = eligibleItems.length;

  async function handleConfirm() {
    const result = onConfirm();
    if (result instanceof Promise) {
      setIsConfirming(true);
      try {
        await result;
      } finally {
        setIsConfirming(false);
      }
    }
  }

  const skipReason = nextStatus === 'ORDERED' ? 'already ordered or received' : 'not yet ordered, or already received';
  const eligibilityNote =
    skippedCount > 0
      ? `${count} item${count === 1 ? '' : 's'} will be marked as ${verb}. ${skippedCount} item${skippedCount === 1 ? '' : 's'} ${skipReason} will be skipped.`
      : `All ${count} item${count === 1 ? '' : 's'} will be marked as ${verb}.`;

  return (
    <Modal
      isOpen
      onClose={isConfirming ? () => {} : onCancel}
      title={`Mark ${count} item${count === 1 ? '' : 's'} ${verb}?`}
      subtitle={`Selected items · ${count} item${count === 1 ? '' : 's'}`}
      centered
      footer={
        <>
          <button type="button" className="btn btn--secondary" disabled={isConfirming} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn btn--danger${isConfirming ? ' btn--loading' : ''}`}
            disabled={isConfirming}
            onClick={handleConfirm}
          >
            {isConfirming ? <ButtonDots label="Updating" /> : `Yes, mark ${count} ${verb}`}
          </button>
        </>
      }
    >
      <div className="bulk-change-order-status-modal__transition">
        <StatusPill status={fromStatus} />
        <ArrowRight size={16} aria-hidden="true" />
        <StatusPill status={nextStatus} />
      </div>

      <ul className="bulk-change-order-status-modal__list">
        {eligibleItems.map((item) => (
          <li key={item.id} className="bulk-change-order-status-modal__row">
            <CategoryIcon category={item.category} name={item.itemName} size={36} imageId={item.imageId} />
            <div className="bulk-change-order-status-modal__row-text">
              <div className="bulk-change-order-status-modal__row-name">{item.itemName}</div>
              <div className="bulk-change-order-status-modal__row-meta">{item.meta}</div>
            </div>
            <div className="bulk-change-order-status-modal__row-qty">{item.quantityLabel}</div>
          </li>
        ))}
      </ul>

      <p className="bulk-change-order-status-modal__note">{eligibilityNote}</p>
    </Modal>
  );
}

export default BulkChangeOrderStatusModal;
