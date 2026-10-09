import { useEffect, useState, type FormEvent } from 'react';
import type { StoreInventoryItemOption } from '../types/stockCheck';
import Modal from './Modal';
import { isQtyInputAllowed, isWholeNumberUnit, parseQty, qtyRuleHint } from '../utils/quantity';
import FormField from './FormField';
import Select from './Select';
import ButtonDots from './ButtonDots';

export interface AdHocShortageValues {
  storeInventoryItemId: number;
  currentStock: string;
  quantity: string;
  note: string;
}

interface AdHocShortageModalProps {
  isOpen: boolean;
  items: StoreInventoryItemOption[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: AdHocShortageValues) => void;
}

const EMPTY_VALUES: AdHocShortageValues = { storeInventoryItemId: 0, currentStock: '', quantity: '', note: '' };

function AdHocShortageModal({ isOpen, items, errorMessage, isSubmitting = false, onClose, onSubmit }: AdHocShortageModalProps) {
  const [values, setValues] = useState<AdHocShortageValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof AdHocShortageValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY_VALUES);
      setErrors({});
    }
  }, [isOpen]);

  const selectedItem = items.find((item) => item.storeInventoryItemId === values.storeInventoryItemId);
  const selectedUnit = selectedItem?.unitOfMeasurement;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.storeInventoryItemId) nextErrors.storeInventoryItemId = 'Item is required';
    const current = parseQty(values.currentStock, selectedUnit);
    if (current === null || current < 0) nextErrors.currentStock = `Enter ${qtyRuleHint(selectedUnit)} (0 or more)`;
    const qty = parseQty(values.quantity, selectedUnit);
    if (qty === null || qty <= 0) nextErrors.quantity = `Enter ${qtyRuleHint(selectedUnit)} greater than 0`;
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSubmit(values);
  }

  const itemOptions = items.map((item) => ({
    value: String(item.storeInventoryItemId),
    label: `${item.itemName} (${item.unitOfMeasurement})`,
  }));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      centered
      title="Report a Shortage"
      subtitle="Running low mid-day? Enter what is left now and what you need. Usage so far is recorded and the item goes to the order list."
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="ad-hoc-shortage-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Reporting" /> : 'Report Shortage'}
          </button>
        </>
      }
    >
      <form id="ad-hoc-shortage-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Item" htmlFor="ad-hoc-item" error={errors.storeInventoryItemId}>
          <Select
            id="ad-hoc-item"
            options={itemOptions}
            value={values.storeInventoryItemId ? String(values.storeInventoryItemId) : ''}
            onChange={(value) => setValues((current) => ({ ...current, storeInventoryItemId: Number(value) }))}
            ariaLabel="Item"
          />
        </FormField>
        <FormField
          label={selectedItem?.currentStock != null ? `Current Stock (expected ${selectedItem.currentStock} ${selectedUnit})` : 'Current Stock'}
          htmlFor="ad-hoc-current"
          error={errors.currentStock}
        >
          <input
            id="ad-hoc-current"
            type="text"
            inputMode={isWholeNumberUnit(selectedUnit) ? 'numeric' : 'decimal'}
            className="input"
            value={values.currentStock}
            onChange={(event) => {
              const next = event.target.value;
              if (!isQtyInputAllowed(next, selectedUnit)) return;
              setValues((current) => ({ ...current, currentStock: next }));
            }}
          />
        </FormField>
        <FormField label="Quantity Needed" htmlFor="ad-hoc-quantity" error={errors.quantity}>
          <input
            id="ad-hoc-quantity"
            type="text"
            inputMode={isWholeNumberUnit(selectedUnit) ? 'numeric' : 'decimal'}
            className="input"
            value={values.quantity}
            onChange={(event) => {
              const next = event.target.value;
              if (!isQtyInputAllowed(next, selectedUnit)) return;
              setValues((current) => ({ ...current, quantity: next }));
            }}
          />
        </FormField>
        <FormField label="Note (optional)" htmlFor="ad-hoc-note">
          <input
            id="ad-hoc-note"
            className="input"
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder="Brief note for the owner"
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default AdHocShortageModal;
