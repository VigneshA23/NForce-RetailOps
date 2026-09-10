import { useEffect, useState, type FormEvent } from 'react';
import type { DailyStockCheckItem } from '../types/stockCheck';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';

export interface AdHocShortageValues {
  storeInventoryItemId: number;
  quantity: string;
  note: string;
}

interface AdHocShortageModalProps {
  isOpen: boolean;
  items: DailyStockCheckItem[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: AdHocShortageValues) => void;
}

const EMPTY_VALUES: AdHocShortageValues = { storeInventoryItemId: 0, quantity: '', note: '' };

function AdHocShortageModal({ isOpen, items, errorMessage, isSubmitting = false, onClose, onSubmit }: AdHocShortageModalProps) {
  const [values, setValues] = useState<AdHocShortageValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof AdHocShortageValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY_VALUES);
      setErrors({});
    }
  }, [isOpen]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.storeInventoryItemId) nextErrors.storeInventoryItemId = 'Item is required';
    const qty = Number(values.quantity);
    if (!values.quantity.trim() || Number.isNaN(qty) || qty < 1) nextErrors.quantity = 'Quantity must be at least 1';
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
      subtitle="Add an item to the order list outside your scheduled stock check."
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="ad-hoc-shortage-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Reporting...' : 'Report Shortage'}
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
        <FormField label="Quantity Needed" htmlFor="ad-hoc-quantity" error={errors.quantity}>
          <input
            id="ad-hoc-quantity"
            type="number"
            min={1}
            className="input"
            value={values.quantity}
            onChange={(event) => setValues((current) => ({ ...current, quantity: event.target.value }))}
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
