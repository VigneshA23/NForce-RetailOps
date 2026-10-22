import { useEffect, useState, type FormEvent } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import ButtonDots from './ButtonDots';
import { isQtyInputAllowed, isWholeNumberUnit, parseQty, qtyRuleHint, roundQty } from '../utils/quantity';
import type { OpenOrder } from '../types/stockCheck';
import './ReceivedStockModal.css';

export interface ReceivedItemInput {
  orderId: number;
  quantity: number;
}

interface ReceivedStockModalProps {
  isOpen: boolean;
  itemName: string;
  unit: string;
  // End of Day mode: today's Start of Day and End of Day usable stock. Start
  // of Day mode: what Start of Day should be (the last End of Day plus
  // deliveries since) and the Start of Day total counted.
  startUsable: number;
  endUsable: number;
  // End of Day only: the dead stock typed with the count, so the current stock
  // asked for here is checked against it.
  deadStock?: number;
  // Which count is being explained; defaults to End of Day.
  snapshot?: 'START_OF_DAY' | 'END_OF_DAY';
  // Already logged as received today, or reported and waiting on approval.
  alreadyReceived?: number;
  // Ordered orders for this item; all of them are confirmed as received.
  orders?: OpenOrder[];
  isSubmitting?: boolean;
  // currentStock is only passed at End of Day.
  onConfirm: (items: ReceivedItemInput[], currentStock?: number) => void;
  onCancel: () => void;
}

// Shown when a Start of Day is above the last End of Day, or an End of Day is
// above Start of Day, which can only mean an Ordered order arrived. The
// employee is not asked to pick anything: the Ordered orders are listed as
// read-only details and confirming sends all of them to the admin for
// approval; nothing is applied here.
//
// Start of Day ignores the typed count (it becomes the last End of Day plus the
// received orders once approved). End of Day also asks for the current stock in
// the store, which replaces the typed count and is what usage is worked out from.
function ReceivedStockModal({
  isOpen,
  itemName,
  unit,
  startUsable,
  endUsable,
  deadStock = 0,
  snapshot = 'END_OF_DAY',
  alreadyReceived = 0,
  orders = [],
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ReceivedStockModalProps) {
  const isStart = snapshot === 'START_OF_DAY';
  const [currentStock, setCurrentStock] = useState('');
  const [error, setError] = useState<string | null>(null);

  const orderedTotal = roundQty(orders.reduce((sum, o) => sum + o.quantity, 0));

  useEffect(() => {
    if (isOpen) {
      setCurrentStock(isStart ? '' : String(roundQty(endUsable + deadStock)));
      setError(null);
    }
    // Reset only when the popup opens, not as the figures behind it refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (orders.length === 0) {
      setError('There is no Ordered order to confirm');
      return;
    }
    const items = orders.map((o) => ({ orderId: o.id, quantity: o.quantity }));
    if (isStart) {
      onConfirm(items);
      return;
    }
    const stock = parseQty(currentStock, unit);
    if (stock === null) {
      setError(`Enter ${qtyRuleHint(unit)}`);
      return;
    }
    if (stock < deadStock) {
      setError('Current stock cannot be less than the dead stock');
      return;
    }
    const maximum = roundQty(startUsable + alreadyReceived + orderedTotal);
    if (roundQty(stock - deadStock) > maximum) {
      setError(`Current stock cannot be more than ${roundQty(maximum + deadStock)} (Start of Day plus the received order)`);
      return;
    }
    onConfirm(items, stock);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      centered
      title={isStart ? 'Confirm stock restocked' : 'Confirm stock received today'}
      subtitle={
        isStart
          ? `${itemName}: Start of Day (${endUsable} ${unit}) is higher than the last End of Day (${startUsable} ${unit}), so the item must have been restocked. Confirm the existing order(s) below that were received. Your admin has to approve it before stock is updated.`
          : `${itemName}: End of Day (${endUsable} ${unit}) is higher than Start of Day (${startUsable} ${unit}), so stock must have been received. Confirm the existing order(s) below that were received and enter the current stock in the store, which is used to calculate today's usage. Your admin has to approve it before stock is updated.`
      }
      footer={
        <>
          <button type="button" className="btn btn--secondary" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form="received-stock-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Submit for approval'}
          </button>
        </>
      }
    >
      <form id="received-stock-form" onSubmit={handleSubmit} noValidate>
        <div className="received-stock-modal__choices">
          <p className="received-stock-modal__legend">Existing orders received:</p>
          <ul>
            {orders.map((order) => (
              <li key={order.id}>
                Order #{order.id} · {order.quantity} {unit}
                {order.supplierName ? ` · ${order.supplierName}` : ''}
              </li>
            ))}
          </ul>
        </div>
        {isStart ? (
          error && <p className="form-field__error" role="alert">{error}</p>
        ) : (
          <FormField label={`Current stock in the store (${unit})`} htmlFor="received-stock-current" error={error ?? undefined}>
            <input
              id="received-stock-current"
              type="text"
              inputMode={isWholeNumberUnit(unit) ? 'numeric' : 'decimal'}
              className="input"
              autoFocus
              value={currentStock}
              onChange={(event) => {
                const next = event.target.value;
                if (!isQtyInputAllowed(next, unit)) return;
                setCurrentStock(next);
                setError(null);
              }}
            />
          </FormField>
        )}
      </form>
    </Modal>
  );
}

export default ReceivedStockModal;
