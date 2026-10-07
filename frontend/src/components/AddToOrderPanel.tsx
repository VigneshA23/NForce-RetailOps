import { useEffect, useState, type FormEvent } from 'react';
import { Info } from 'lucide-react';
import type { CreateOrderListEntryValues } from '../types/orderList';
import { INVENTORY_ITEM_CATEGORY_OPTIONS, type InventoryItemCategory } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
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
  suppliers: Supplier[];
  activeNeedByItemId?: Map<number, ActiveItemNeed>;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CreateOrderListEntryValues) => void;
}

type Source = 'inventory' | 'custom';

interface FormState {
  source: Source;
  storeInventoryItemId: number | null;
  customName: string;
  customUnit: string;
  customCategory: InventoryItemCategory | null;
  saveToInventory: boolean;
  quantity: number;
  supplierId: number | null;
  note: string;
}

function emptyState(): FormState {
  return {
    source: 'inventory',
    storeInventoryItemId: null,
    customName: '',
    customUnit: '',
    customCategory: null,
    saveToInventory: false,
    // Defaults to 0, not 1 -- this is almost always a top-up on an item that
    // already has a system-calculated Need (see the hint shown once an item
    // with one is selected), so submitting without deliberately choosing an
    // amount should not silently add anything.
    quantity: 0,
    supplierId: null,
    note: '',
  };
}

// Manually adding to the order list, outside the automatic shortage
// detection stock checks normally drive -- an existing catalog item, or a
// one-off not (yet) in the catalog. See CreateOrderListEntryValues for the
// two shapes this maps onto.
function AddToOrderPanel({
  isOpen,
  storeName,
  inventoryItems,
  suppliers,
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
    if (values.source === 'inventory' && values.storeInventoryItemId == null) {
      setValidationError('Choose an item');
      return;
    }
    if (values.source === 'custom' && !values.customName.trim()) {
      setValidationError('Enter an item name to continue');
      return;
    }
    if (values.source === 'custom' && !values.customUnit.trim()) {
      setValidationError('Enter a unit to continue');
      return;
    }
    if (values.quantity < 1) {
      setValidationError('Quantity must be at least 1');
      return;
    }
    setValidationError(undefined);

    const selectedItem = inventoryItems.find((item) => item.id === values.storeInventoryItemId);
    onSubmit(
      values.source === 'inventory'
        ? {
            storeInventoryItemId: values.storeInventoryItemId,
            itemName: '',
            category: null,
            unitOfMeasurement: '',
            saveToInventory: false,
            quantityNeeded: String(values.quantity),
            // No Supplier field for this tab (see below) -- the item's own
            // preferred supplier is used automatically.
            supplierId: selectedItem?.preferredSupplierId ?? null,
            note: values.note,
          }
        : {
            storeInventoryItemId: null,
            itemName: values.customName,
            category: values.customCategory,
            unitOfMeasurement: values.customUnit,
            saveToInventory: values.saveToInventory,
            quantityNeeded: String(values.quantity),
            supplierId: values.supplierId,
            note: values.note,
          },
    );
  }

  const inventoryOptions = inventoryItems.map((item) => ({ value: String(item.id), label: item.name }));
  const supplierOptions = [
    { value: '', label: 'No supplier' },
    ...suppliers.filter((s) => s.active).map((s) => ({ value: String(s.id), label: s.name })),
  ];
  const categoryOptions = [{ value: '', label: 'No category' }, ...INVENTORY_ITEM_CATEGORY_OPTIONS];
  const selectedItem = inventoryItems.find((item) => item.id === values.storeInventoryItemId);
  const unit = values.source === 'inventory' ? selectedItem?.unitOfMeasurement ?? '' : values.customUnit;
  const existingNeed =
    values.source === 'inventory' && values.storeInventoryItemId != null
      ? activeNeedByItemId?.get(values.storeInventoryItemId)
      : undefined;

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
        <div role="tablist" aria-label="Item source" className="add-to-order-panel__source-tabs">
          <button
            type="button"
            role="tab"
            aria-selected={values.source === 'inventory'}
            className={`add-to-order-panel__source-tab${values.source === 'inventory' ? ' add-to-order-panel__source-tab--active' : ''}`}
            onClick={() => setValues((current) => ({ ...current, source: 'inventory' }))}
          >
            From inventory
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={values.source === 'custom'}
            className={`add-to-order-panel__source-tab${values.source === 'custom' ? ' add-to-order-panel__source-tab--active' : ''}`}
            onClick={() => setValues((current) => ({ ...current, source: 'custom' }))}
          >
            Other item
          </button>
        </div>

        {values.source === 'inventory' ? (
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
        ) : (
          <>
            <FormField label="Item name" htmlFor="ato-name">
              <input
                id="ato-name"
                type="text"
                className="input"
                value={values.customName}
                onChange={(event) => setValues((current) => ({ ...current, customName: event.target.value }))}
                placeholder="e.g. Birthday candles"
              />
            </FormField>
            <div className="add-to-order-panel__row">
              <FormField label="Unit" htmlFor="ato-unit">
                <input
                  id="ato-unit"
                  type="text"
                  className="input"
                  value={values.customUnit}
                  onChange={(event) => setValues((current) => ({ ...current, customUnit: event.target.value }))}
                  placeholder="e.g. packs"
                />
              </FormField>
              <FormField label="Category" htmlFor="ato-category">
                <Select
                  id="ato-category"
                  options={categoryOptions}
                  value={values.customCategory ?? ''}
                  onChange={(value) => setValues((current) => ({ ...current, customCategory: value === '' ? null : (value as InventoryItemCategory) }))}
                  ariaLabel="Category"
                  indicator="radio"
                />
              </FormField>
            </div>
            <label className="add-to-order-panel__checkbox">
              <input
                type="checkbox"
                checked={values.saveToInventory}
                onChange={(event) => setValues((current) => ({ ...current, saveToInventory: event.target.checked }))}
              />
              <span>
                Also add to {storeName ?? 'this store'}&rsquo;s inventory
                <span className="add-to-order-panel__checkbox-hint">
                  Leave unchecked for a one-time purchase. You can set a minimum for it later.
                </span>
              </span>
            </label>
          </>
        )}

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

        {/* Only for a brand-new custom item -- an existing inventory item
            already has its own preferred supplier, used automatically. */}
        {values.source === 'custom' && (
          <FormField label="Supplier" htmlFor="ato-supplier">
            <Select
              id="ato-supplier"
              options={supplierOptions}
              value={values.supplierId != null ? String(values.supplierId) : ''}
              onChange={(value) => setValues((current) => ({ ...current, supplierId: value === '' ? null : Number(value) }))}
              ariaLabel="Supplier"
            />
          </FormField>
        )}

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
