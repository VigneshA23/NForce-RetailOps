import { useEffect, useState, type FormEvent } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import ButtonDots from './ButtonDots';
import { isQtyInputAllowed, isWholeNumberUnit, parseQty, qtyRuleHint, roundQty } from '../utils/quantity';
import type { OpenOrder } from '../types/stockCheck';
import './ReceivedStockModal.css';

export interface ReceivedItemInput {
  // null = new stock that is not on any order.
  orderId: number | null;
  quantity: number;
}

interface ReceivedStockModalProps {
  isOpen: boolean;
  itemName: string;
  unit: string;
  startUsable: number;
  endUsable: number;
  // Already logged as received today, or reported and waiting on approval.
  alreadyReceived?: number;
  // Ordered orders for this item the employee can confirm as received.
  orders?: OpenOrder[];
  isSubmitting?: boolean;
  onConfirm: (items: ReceivedItemInput[]) => void;
  onCancel: () => void;
}

// Shown when an End of Day count is higher than the Start of Day count, which
// can only mean stock arrived during the day, so a received quantity is
// required. It must cover the gap (Start of Day + received >= End of Day) so
// usage never comes out negative. Nothing is applied here: each reported item
// goes to the admin as a request, either for new stock or to confirm existing
// Ordered orders as received.
//
// New stock and orders are mutually exclusive. There is one quantity box:
// selecting orders fills it with their ordered total, rising and falling as
// orders are ticked and unticked. It is only editable for new stock or a single
// order (a partial delivery); with several orders each is confirmed at the
// quantity ordered.
function ReceivedStockModal({
  isOpen,
  itemName,
  unit,
  startUsable,
  endUsable,
  alreadyReceived = 0,
  orders = [],
  isSubmitting = false,
  onConfirm,
  onCancel,
}: ReceivedStockModalProps) {
  const hasOrders = orders.length > 0;
  const [newStock, setNewStock] = useState(false);
  const [orderIds, setOrderIds] = useState<number[]>([]);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const showNewStockOnly = !hasOrders;
  const ordersSelected = orderIds.length > 0;
  const quantityEditable = showNewStockOnly || newStock || orderIds.length === 1;

  useEffect(() => {
    if (isOpen) {
      setNewStock(false);
      setOrderIds([]);
      setQuantity('');
      setError(null);
    }
  }, [isOpen]);

  function orderedTotal(ids: number[]): number {
    return roundQty(orders.filter((o) => ids.includes(o.id)).reduce((sum, o) => sum + o.quantity, 0));
  }

  function toggleNewStock() {
    setError(null);
    setNewStock((current) => !current);
    setQuantity('');
  }

  function toggleOrder(id: number) {
    setError(null);
    const next = orderIds.includes(id) ? orderIds.filter((i) => i !== id) : [...orderIds, id];
    setOrderIds(next);
    setQuantity(next.length === 0 ? '' : String(orderedTotal(next)));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (hasOrders && !newStock && !ordersSelected) {
      setError('Select what was received');
      return;
    }
    const value = parseQty(quantity, unit);
    if (value === null || value <= 0) {
      setError(`Enter ${qtyRuleHint(unit)} greater than 0`);
      return;
    }
    const minimum = roundQty(endUsable - startUsable - alreadyReceived);
    if (roundQty(startUsable + alreadyReceived + value) < endUsable) {
      setError(`Value should be greater than or equal to ${minimum}`);
      return;
    }
    if (ordersSelected) {
      onConfirm(
        orderIds.length === 1
          ? [{ orderId: orderIds[0], quantity: value }]
          : orderIds.map((id) => ({ orderId: id, quantity: orders.find((o) => o.id === id)!.quantity })),
      );
      return;
    }
    onConfirm([{ orderId: null, quantity: value }]);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      centered
      title="Enter stock received today"
      subtitle={`${itemName}: End of Day (${endUsable} ${unit}) is higher than Start of Day (${startUsable} ${unit}), so stock must have been received. Enter the quantity so today's usage is calculated correctly. Your admin has to approve it before stock is updated.`}
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
        {hasOrders && (
          <fieldset className="received-stock-modal__choices">
            <legend className="received-stock-modal__legend">What was received? Choose new stock, or one or more existing orders.</legend>
            <label className="received-stock-modal__choice">
              <input type="checkbox" checked={newStock} disabled={ordersSelected} onChange={toggleNewStock} />
              <span>New stock, not on an existing order</span>
            </label>
            {orders.map((order) => (
              <label key={order.id} className="received-stock-modal__choice">
                <input
                  type="checkbox"
                  checked={orderIds.includes(order.id)}
                  disabled={newStock}
                  onChange={() => toggleOrder(order.id)}
                />
                <span>
                  Ordered: Order #{order.id} · {order.quantity} {unit}
                  {order.supplierName ? ` · ${order.supplierName}` : ''}
                </span>
              </label>
            ))}
          </fieldset>
        )}
        <FormField label={`Stock received today (${unit})`} htmlFor="received-stock-quantity" error={error ?? undefined}>
          <input
            id="received-stock-quantity"
            type="text"
            inputMode={isWholeNumberUnit(unit) ? 'numeric' : 'decimal'}
            className="input"
            autoFocus={!hasOrders}
            value={quantity}
            readOnly={!quantityEditable}
            onChange={(event) => {
              const next = event.target.value;
              if (!isQtyInputAllowed(next, unit)) return;
              setQuantity(next);
              setError(null);
            }}
          />
        </FormField>
      </form>
    </Modal>
  );
}

export default ReceivedStockModal;
