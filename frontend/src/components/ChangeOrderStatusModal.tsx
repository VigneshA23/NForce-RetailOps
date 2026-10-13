import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import Modal from './Modal';
import ButtonDots from './ButtonDots';
import CategoryIcon from './CategoryIcon';
import FormField from './FormField';
import { STATUS_META } from '../utils/orderListStatus';
import { formatQty, isQtyInputAllowed, isWholeNumberUnit, parseQty, qtyRuleHint, roundQty } from '../utils/quantity';
import type { OrderStatus } from '../types/orderList';
import type { InventoryItemCategory } from '../types/storeInventory';
import './ChangeOrderStatusModal.css';

interface ChangeOrderStatusModalProps {
  itemName: string;
  supplierName: string | null;
  category: InventoryItemCategory | null;
  imageId: number | null;
  fromStatus: OrderStatus;
  toStatus: OrderStatus;
  // Total ordered (quantity needed + manual top-up) and its unit: the default
  // for the "quantity received" box shown on Ordered -> Received.
  orderedQuantity: number;
  unitOfMeasurement: string;
  // Other Ordered rows for the same item (each requirement is its own row).
  // When present on Ordered -> Received, a checkbox lets the user receive them
  // in the same delivery: the quantity box then covers all of them.
  otherOrdered?: { ids: number[]; quantity: number };
  // May return a Promise -- same loading-dots/disable-while-pending contract
  // as ConfirmDialog's onConfirm. quantityReceived and alsoReceivedEntryIds are
  // only set when moving to Received.
  onConfirm: (quantityReceived?: number, alsoReceivedEntryIds?: number[]) => void | Promise<void>;
  onCancel: () => void;
}

// Plain-English blurb under the From -> To pill, tailored to the two
// one-step-forward transitions the status dropdown is actually meant for
// (see OrderListService.ALLOWED_TRANSITIONS on the backend). Anything else
// the dropdown technically lets you pick -- a backward move, or skipping a
// step -- still gets a sensible, if generic, description rather than no text
// at all.
function describeTransition(from: OrderStatus, to: OrderStatus, supplierName: string | null): string {
  if (from === 'NEEDS_ORDERING' && to === 'ORDERED') {
    return supplierName ? `This marks the item as ordered from ${supplierName}.` : 'This marks the item as ordered.';
  }
  if (from === 'ORDERED' && to === 'RECEIVED') {
    return 'This marks the delivery as received and closes the item.';
  }
  if (to === 'NEEDS_ORDERING') {
    return 'This reopens the item as needing to be ordered again.';
  }
  return `This changes the status from ${STATUS_META[from].label} to ${STATUS_META[to].label}.`;
}

function StatusPill({ status }: { status: OrderStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className="change-order-status-modal__pill" style={{ background: meta.bg, color: meta.fg }}>
      <span className="change-order-status-modal__pill-dot" style={{ background: meta.fg }} aria-hidden="true" />
      {meta.label}
    </span>
  );
}

// Confirms a status change picked from the Order List's per-row dropdown
// before it's actually sent -- the dropdown's own selection is otherwise a
// single click away from marking an order received by accident.
function ChangeOrderStatusModal({
  itemName,
  supplierName,
  category,
  imageId,
  fromStatus,
  toStatus,
  orderedQuantity,
  unitOfMeasurement,
  otherOrdered,
  onConfirm,
  onCancel,
}: ChangeOrderStatusModalProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const isReceiving = fromStatus === 'ORDERED' && toStatus === 'RECEIVED';
  const [receivedText, setReceivedText] = useState(formatQty(orderedQuantity));
  const [receivedError, setReceivedError] = useState<string | null>(null);
  const [alsoReceiveOthers, setAlsoReceiveOthers] = useState(false);
  const hasOthers = isReceiving && !!otherOrdered && otherOrdered.ids.length > 0;

  function handleAlsoReceiveChange(checked: boolean) {
    if (!otherOrdered) return;
    setAlsoReceiveOthers(checked);
    setReceivedText(formatQty(checked ? roundQty(orderedQuantity + otherOrdered.quantity) : orderedQuantity));
    setReceivedError(null);
  }

  async function handleConfirm() {
    let quantityReceived: number | undefined;
    if (isReceiving) {
      const qty = parseQty(receivedText, unitOfMeasurement);
      if (qty === null || qty <= 0) {
        setReceivedError(`Enter ${qtyRuleHint(unitOfMeasurement)} greater than 0`);
        return;
      }
      quantityReceived = qty;
    }
    const result = hasOthers && alsoReceiveOthers ? onConfirm(quantityReceived, otherOrdered.ids) : onConfirm(quantityReceived);
    if (result instanceof Promise) {
      setIsConfirming(true);
      try {
        await result;
      } finally {
        setIsConfirming(false);
      }
    }
  }

  return (
    <Modal
      isOpen
      onClose={isConfirming ? () => {} : onCancel}
      title={isReceiving ? 'Confirm stock received' : 'Change status?'}
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
            {isConfirming ? <ButtonDots label={isReceiving ? 'Receiving' : 'Changing'} /> : isReceiving ? 'Confirm received' : 'Yes, change'}
          </button>
        </>
      }
    >
      <div className="change-order-status-modal__item">
        <CategoryIcon category={category} name={itemName} size={40} imageId={imageId} />
        <div className="change-order-status-modal__item-text">
          <div className="change-order-status-modal__item-name">{itemName}</div>
          {supplierName && <div className="change-order-status-modal__item-supplier">{supplierName}</div>}
        </div>
      </div>
      <div className="change-order-status-modal__transition">
        <StatusPill status={fromStatus} />
        <ArrowRight size={16} aria-hidden="true" />
        <StatusPill status={toStatus} />
      </div>
      <p className="change-order-status-modal__description">{describeTransition(fromStatus, toStatus, supplierName)}</p>
      {isReceiving && (
        <div className="change-order-status-modal__received">
          {hasOthers && (
            <label className="change-order-status-modal__also">
              <input
                type="checkbox"
                checked={alsoReceiveOthers}
                disabled={isConfirming}
                onChange={(event) => handleAlsoReceiveChange(event.target.checked)}
              />
              <span>
                Both orders received (other order: {formatQty(otherOrdered.quantity)} {unitOfMeasurement})
              </span>
            </label>
          )}
          <FormField
            label={`Quantity received (${unitOfMeasurement})`}
            htmlFor="order-quantity-received"
            error={receivedError ?? undefined}
          >
            <input
              id="order-quantity-received"
              type="text"
              inputMode={isWholeNumberUnit(unitOfMeasurement) ? 'numeric' : 'decimal'}
              className="input"
              value={receivedText}
              disabled={isConfirming}
              onChange={(event) => {
                if (!isQtyInputAllowed(event.target.value, unitOfMeasurement)) return;
                setReceivedText(event.target.value);
                setReceivedError(null);
              }}
            />
          </FormField>
          <p className="change-order-status-modal__hint">
            Ordered: {formatQty(orderedQuantity)} {unitOfMeasurement}. Change this if less (or more) arrived. It is added to
            the store&apos;s current stock and checked against today&apos;s minimum.
          </p>
        </div>
      )}
    </Modal>
  );
}

export default ChangeOrderStatusModal;
