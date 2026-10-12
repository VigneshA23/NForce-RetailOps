import { useEffect, useState, type FormEvent } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import ButtonDots from './ButtonDots';
import { isQtyInputAllowed, isWholeNumberUnit, parseQty, qtyRuleHint, roundQty } from '../utils/quantity';

interface ReceivedStockModalProps {
  isOpen: boolean;
  itemName: string;
  unit: string;
  startUsable: number;
  endUsable: number;
  // Already logged as received today (e.g. an order marked Received).
  alreadyReceived?: number;
  isSubmitting?: boolean;
  onConfirm: (quantityReceived: number) => void;
  onCancel: () => void;
}

// Shown when an End of Day count is higher than the Start of Day count, which
// can only mean stock arrived during the day, so a received quantity is
// required. It must cover the gap (Start of Day + received >= End of Day) so
// usage never comes out negative.
function ReceivedStockModal({ isOpen, itemName, unit, startUsable, endUsable, alreadyReceived = 0, isSubmitting = false, onConfirm, onCancel }: ReceivedStockModalProps) {
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setQuantity('');
      setError(null);
    }
  }, [isOpen]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
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
    onConfirm(value);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      centered
      title="Enter stock received today"
      subtitle={`${itemName}: End of Day (${endUsable} ${unit}) is higher than Start of Day (${startUsable} ${unit}), so stock must have been received. Enter the quantity so today's usage is calculated correctly.`}
      footer={
        <>
          <button type="button" className="btn btn--secondary" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" form="received-stock-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Add received & save'}
          </button>
        </>
      }
    >
      <form id="received-stock-form" onSubmit={handleSubmit} noValidate>
        <FormField label={`Stock received today (${unit})`} htmlFor="received-stock-quantity" error={error ?? undefined}>
          <input
            id="received-stock-quantity"
            type="text"
            inputMode={isWholeNumberUnit(unit) ? 'numeric' : 'decimal'}
            className="input"
            autoFocus
            value={quantity}
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
