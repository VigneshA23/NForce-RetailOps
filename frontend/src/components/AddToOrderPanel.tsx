import { useEffect, useState, type FormEvent } from 'react';
import { Info } from 'lucide-react';
import type { CreateOrderListEntryValues } from '../types/orderList';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import QuantityStepper from './QuantityStepper';
import ButtonDots from './ButtonDots';
import './AddToOrderPanel.css';

export interface OrderableInventoryItem {
  id: number;
  name: string;
  unitOfMeasurement: string;
  preferredSupplierId: number | null;
}

// At most one active (non-RECEIVED) order-list entry per item, keyed by
// storeInventoryItemId -- lets the panel show what's already queued for an
// item before the user adds more on top of it.
export interface ActiveItemNeed {
  quantityNeeded: number;
  manualAddition: number;
}

interface AddToOrderPanelProps {
  isOpen: boolean;
  storeName?: string | null;
  inventoryItems: OrderableInventoryItem[];
  activeNeedByItemId?: Map<number, ActiveItemNeed>;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CreateOrderListEntryValues) => void;
}

interface FormState {
  storeInventoryItemId: number | null;
  quantity: number;
  note: string;
}

function emptyState(): FormState {
  return {
    storeInventoryItemId: null,
    // Defaults to 0, not 1 -- this is almost always a top-up on an item that
    // already has a system-calculated Need (see the hint shown once an item
    // with one is selected), so submitting without deliberately choosing an
    // amount should not silently add anything.
    quantity: 0,
    note: '',
  };
}

// Manually topping up an existing catalog item's order quantity, outside the
// automatic shortage detection stock checks normally drive.
function AddToOrderPanel({
  isOpen,
  storeName,
  inventoryItems,
  activeNeedByItemId,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: AddToOrderPanelProps) {
  const [values, setValues] = useState<FormState>(emptyState);
  const [validationError, setValidationError] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen) {
      setValues(emptyState());
      setValidationError(undefined);
    }
    // Only reset when the panel opens -- inventoryItems can re-fetch while
    // it's open (e.g. background polling) without wiping in-progress input.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (values.storeInventoryItemId == null) {
      setValidationError('Choose an item');
      return;
    }
    if (values.quantity < 1) {
      setValidationError('Quantity must be at least 1');
      return;
    }
    setValidationError(undefined);

    const selectedItem = inventoryItems.find((item) => item.id === values.storeInventoryItemId);
    onSubmit({
      storeInventoryItemId: values.storeInventoryItemId,
      itemName: '',
      category: null,
      unitOfMeasurement: '',
      saveToInventory: false,
      minWeekday: '0',
      minWeekend: '',
      quantityNeeded: String(values.quantity),
      // No Supplier field here -- the item's own preferred supplier is used
      // automatically.
      supplierId: selectedItem?.preferredSupplierId ?? null,
      note: values.note,
    });
  }

  const inventoryOptions = inventoryItems.map((item) => ({ value: String(item.id), label: item.name }));
  const selectedItem = inventoryItems.find((item) => item.id === values.storeInventoryItemId);
  const unit = selectedItem?.unitOfMeasurement ?? '';
  const existingNeed = values.storeInventoryItemId != null ? activeNeedByItemId?.get(values.storeInventoryItemId) : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="panel"
      title="Add to order"
      subtitle={storeName ? `${storeName} · for extra stock outside the daily count` : 'For extra stock outside the daily count'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-to-order-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Adding" /> : 'Add to order list'}
          </button>
        </>
      }
    >
      <form id="add-to-order-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Item" htmlFor="ato-item">
          <Select
            id="ato-item"
            options={inventoryOptions}
            value={values.storeInventoryItemId != null ? String(values.storeInventoryItemId) : ''}
            onChange={(value) => setValues((current) => ({ ...current, storeInventoryItemId: value === '' ? null : Number(value) }))}
            ariaLabel="Item"
            placeholder={inventoryOptions.length === 0 ? 'No inventory items yet' : 'Select an item'}
            disabled={inventoryOptions.length === 0}
          />
          {existingNeed && (
            <p className="add-to-order-panel__need-hint">
              Already needs <b>{existingNeed.quantityNeeded + existingNeed.manualAddition} {unit}</b> -- this adds extra on top.
            </p>
          )}
        </FormField>

        <FormField label="Quantity" htmlFor="ato-quantity">
          <QuantityStepper
            id="ato-quantity"
            value={values.quantity}
            unit={unit}
            min={1}
            ariaLabel="Quantity"
            onChange={(quantity) => setValues((current) => ({ ...current, quantity }))}
          />
        </FormField>

        <FormField label="Note (optional)" htmlFor="ato-note">
          <input
            id="ato-note"
            type="text"
            className="input"
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder="e.g. Saturday event"
          />
        </FormField>

        <div className="add-to-order-panel__info">
          <Info size={16} aria-hidden="true" />
          <span>
            This is added as a <b>Manual</b> order with status Needs ordering. It stays open until marked received.
          </span>
        </div>

        {validationError && <p className="form-field__error">{validationError}</p>}
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default AddToOrderPanel;
