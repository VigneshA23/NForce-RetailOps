import { useEffect, useState, type FormEvent } from 'react';
import type { InventoryCountRow } from '../types/storeInventory';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import QuantityStepper from './QuantityStepper';
import ButtonDots from './ButtonDots';
import './EditInventoryCountModal.css';

export interface EditInventoryCountValues {
  available: number;
  reason: string;
}

interface EditInventoryCountModalProps {
  isOpen: boolean;
  row: InventoryCountRow | null;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: EditInventoryCountValues) => void;
}

const REASON_OPTIONS = [
  { value: 'Recount', label: 'Recount (count was wrong)' },
  { value: 'Delivery received', label: 'Delivery received, restocked' },
  { value: 'Waste or spoilage', label: 'Waste or spoilage' },
  { value: 'Used for event', label: 'Used for event or catering' },
  { value: 'Other', label: 'Other' },
];

// Edits the AVAILABLE stock on an item's latest stock check -- dead stock is
// carried over unchanged, since the Inventory Counts view (and this design)
// only surfaces one editable number, not the available/dead-stock split the
// daily employee check captures. Submits straight to the existing
// correction endpoint (correctStockCheck) -- there's no separate "edit
// count" route.
function EditInventoryCountModal({ isOpen, row, errorMessage, isSubmitting = false, onClose, onSubmit }: EditInventoryCountModalProps) {
  const [available, setAvailable] = useState(0);
  const [reason, setReason] = useState(REASON_OPTIONS[0].value);
  const [note, setNote] = useState('');

  useEffect(() => {
    if (isOpen && row) {
      setAvailable(row.latestAvailable ?? 0);
      setReason(REASON_OPTIONS[0].value);
      setNote('');
    }
  }, [isOpen, row]);

  if (!row) return null;

  const previousAvailable = row.latestAvailable ?? 0;
  const diff = available - previousAvailable;

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const reasonLabel = REASON_OPTIONS.find((option) => option.value === reason)?.label ?? reason;
    onSubmit({
      available,
      reason: note.trim() ? `${reasonLabel} — ${note.trim()}` : reasonLabel,
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Edit count: ${row.name}`}
      subtitle={`Last count ${previousAvailable} ${row.unitOfMeasurement}${row.minimum != null ? ` · minimum ${row.minimum} ${row.unitOfMeasurement}` : ''}`}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-inventory-count-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Save count'}
          </button>
        </>
      }
    >
      <form id="edit-inventory-count-form" onSubmit={handleSubmit} noValidate>
        <FormField label="New count" htmlFor="eic-count">
          <QuantityStepper id="eic-count" value={available} unit={row.unitOfMeasurement} min={0} ariaLabel="New count" onChange={setAvailable} />
        </FormField>
        {diff !== 0 && (
          <p className="edit-inventory-count-modal__diff">
            {diff > 0 ? '+' : ''}
            {diff} {row.unitOfMeasurement} vs. last count
          </p>
        )}
        <FormField label="Reason" htmlFor="eic-reason">
          <Select id="eic-reason" options={REASON_OPTIONS} value={reason} onChange={setReason} ariaLabel="Reason" />
        </FormField>
        <FormField label="Note (optional)" htmlFor="eic-note">
          <input
            id="eic-note"
            type="text"
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Found 2 extra in the back freezer"
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default EditInventoryCountModal;
