import { useEffect, useState, type FormEvent } from 'react';
import type { OrderListEntry, OrderStatus, UpdateOrderListEntryValues } from '../types/orderList';
import type { Supplier } from '../types/supplier';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import ButtonDots from './ButtonDots';

interface OrderListEntryEditModalProps {
  isOpen: boolean;
  entry: OrderListEntry | null;
  suppliers: Supplier[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: UpdateOrderListEntryValues) => void;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEEDS_ORDERING: 'Needs Ordering',
  ORDERED: 'Ordered',
  RECEIVED: 'Received',
};

// Orders move forward one step at a time -- Needs Ordering -> Ordered ->
// Received -- never skipped or reversed (enforced again, authoritatively, by
// OrderListService.updateEntry server-side). The dropdown only ever offers
// the entry's current status (so saving unrelated fields like quantity/note
// without touching status still works) plus its one legal next step, rather
// than all 3 statuses regardless of where the order actually is.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  NEEDS_ORDERING: 'ORDERED',
  ORDERED: 'RECEIVED',
};

function statusOptionsFor(currentStatus: OrderStatus): { value: OrderStatus; label: string }[] {
  const next = NEXT_STATUS[currentStatus];
  const statuses = next ? [currentStatus, next] : [currentStatus];
  return statuses.map((value) => ({ value, label: STATUS_LABELS[value] }));
}

function OrderListEntryEditModal({
  isOpen,
  entry,
  suppliers,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: OrderListEntryEditModalProps) {
  const [values, setValues] = useState<UpdateOrderListEntryValues>({
    quantityNeeded: '',
    supplierId: null,
    note: '',
    status: 'NEEDS_ORDERING',
  });
  const [validationError, setValidationError] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen && entry) {
      setValues({
        quantityNeeded: String(entry.quantityNeeded),
        supplierId: entry.supplierId,
        note: entry.note ?? '',
        status: entry.status,
      });
      setValidationError(undefined);
    }
  }, [isOpen, entry]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const qty = Number(values.quantityNeeded);
    if (!values.quantityNeeded.trim() || Number.isNaN(qty) || qty < 1) {
      setValidationError('Quantity must be at least 1');
      return;
    }
    onSubmit(values);
  }

  const supplierOptions = [
    { value: '', label: 'No supplier' },
    ...suppliers.filter((s) => s.active).map((s) => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={entry ? `Edit Order — ${entry.itemName}` : 'Edit Order'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="order-list-entry-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="order-list-entry-form" onSubmit={handleSubmit} noValidate>
        <FormField label={`Quantity Needed${entry ? ` (${entry.unitOfMeasurement})` : ''}`} htmlFor="order-quantity">
          <input
            id="order-quantity"
            type="number"
            min={1}
            className="input"
            value={values.quantityNeeded}
            onChange={(event) => setValues((current) => ({ ...current, quantityNeeded: event.target.value }))}
          />
        </FormField>
        <FormField label="Supplier" htmlFor="order-supplier">
          <Select
            id="order-supplier"
            options={supplierOptions}
            value={values.supplierId != null ? String(values.supplierId) : ''}
            onChange={(value) => setValues((current) => ({ ...current, supplierId: value === '' ? null : Number(value) }))}
            ariaLabel="Supplier"
          />
        </FormField>
        <FormField label="Status" htmlFor="order-status">
          <Select
            id="order-status"
            options={entry ? statusOptionsFor(entry.status) : []}
            value={values.status}
            onChange={(value) => setValues((current) => ({ ...current, status: value as OrderStatus }))}
            ariaLabel="Status"
          />
        </FormField>
        <FormField label="Note (optional)" htmlFor="order-note">
          <textarea
            id="order-note"
            className="input"
            rows={2}
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder="Any notes for this order"
          />
        </FormField>
        {validationError && <p className="form-field__error">{validationError}</p>}
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default OrderListEntryEditModal;
