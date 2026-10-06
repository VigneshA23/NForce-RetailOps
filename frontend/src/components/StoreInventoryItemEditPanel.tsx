import { useEffect, useState, type FormEvent } from 'react';
import { Zap } from 'lucide-react';
import { INVENTORY_ITEM_CATEGORY_OPTIONS, type InventoryItemCategory, type StoreInventoryItem, type StoreInventoryItemFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import SupplierCombobox from './SupplierCombobox';
import CounterStepper from './CounterStepper';
import Toggle from './Toggle';
import ItemIcon from './ItemIcon';
import InventoryImagePicker from './InventoryImagePicker';
import ButtonDots from './ButtonDots';
import { inventoryUnitOptionsFor } from '../utils/inventoryUnits';
import './StoreInventoryItemEditPanel.css';

interface StoreInventoryItemEditPanelProps {
  isOpen: boolean;
  item: StoreInventoryItem;
  suppliers: Supplier[];
  onCreateSupplier: (name: string) => Promise<Supplier>;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: StoreInventoryItemFormValues) => void;
}

function toFormValues(item: StoreInventoryItem): StoreInventoryItemFormValues {
  return {
    storeId: null,
    name: item.name,
    category: item.category ?? 'INGREDIENTS',
    unitOfMeasurement: item.unitOfMeasurement,
    minWeekday: item.minWeekday != null ? String(item.minWeekday) : '',
    minWeekend: item.minWeekend != null ? String(item.minWeekend) : '',
    preferredSupplierId: item.preferredSupplierId,
    note: item.note ?? '',
    autoPoEnabled: item.autoPoEnabled,
    imageId: item.imageId,
    imagePhotoId: null,
    imagePreviewUrl: null,
    removeImage: false,
  };
}

function StoreInventoryItemEditPanel({
  isOpen,
  item,
  suppliers,
  onCreateSupplier,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: StoreInventoryItemEditPanelProps) {
  const [values, setValues] = useState<StoreInventoryItemFormValues>(toFormValues(item));
  const [errors, setErrors] = useState<Partial<Record<keyof StoreInventoryItemFormValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(toFormValues(item));
      setErrors({});
    }
    // Deliberately keyed on item.id, not the whole item object -- the 60s
    // background poll in StoreInventory.tsx replaces every item reference on
    // each refresh, and resetting in-progress edits whenever that happens
    // (rather than only when switching to a different item) would be jarring.
  }, [isOpen, item.id]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.name.trim()) nextErrors.name = 'Name is required';
    if (!values.unitOfMeasurement.trim()) nextErrors.unitOfMeasurement = 'Unit is required';
    if (values.minWeekday.trim() === '' || Number(values.minWeekday) < 0) {
      nextErrors.minWeekday = 'Weekday min is required and cannot be negative';
    }
    if (values.minWeekend.trim() !== '' && Number(values.minWeekend) < 0) {
      nextErrors.minWeekend = 'Weekend min cannot be negative';
    }
    if (!values.preferredSupplierId) {
      nextErrors.preferredSupplierId = 'Preferred supplier is required';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({
      ...values,
      name: values.name.trim(),
      unitOfMeasurement: values.unitOfMeasurement.trim(),
      note: values.note.trim(),
    });
  }

  const unitOptions = inventoryUnitOptionsFor(item.unitOfMeasurement);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="item-edit-panel"
      titleIcon={<ItemIcon id={item.id} name={item.name} size="sm" imageId={item.imageId} />}
      title="Item Configuration"
      titleExtra={<span className={`badge ${item.active ? 'badge--success' : 'badge--outline'} item-edit-panel__status`}>{item.active ? 'Active' : 'Inactive'}</span>}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="item-edit-panel-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Save & Sync Rules'}
          </button>
        </>
      }
    >
      <form id="item-edit-panel-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Item Name" htmlFor="edit-item-name" error={errors.name}>
          <input
            id="edit-item-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
          />
        </FormField>

        <FormField label="Display Image (optional)" htmlFor="edit-item-image">
          <InventoryImagePicker
            id="edit-item-image"
            itemName={values.name}
            value={values}
            onChange={(image) => setValues((current) => ({ ...current, ...image }))}
          />
        </FormField>

        <div className="item-edit-panel__row">
          <FormField label="Category" htmlFor="edit-item-category">
            <Select
              id="edit-item-category"
              options={INVENTORY_ITEM_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
              value={values.category}
              onChange={(value) => setValues((current) => ({ ...current, category: value as InventoryItemCategory }))}
              ariaLabel="Category"
              indicator="radio"
            />
          </FormField>
          <FormField label="Unit of Measurement" htmlFor="edit-item-unit" error={errors.unitOfMeasurement}>
            <Select
              id="edit-item-unit"
              options={unitOptions}
              value={values.unitOfMeasurement}
              onChange={(value) => setValues((current) => ({ ...current, unitOfMeasurement: value }))}
              ariaLabel="Unit"
              placeholder="Select unit..."
              indicator="radio"
            />
          </FormField>
        </div>

        <div className="item-edit-panel__section">
          <h3 className="item-edit-panel__section-title">Store Parity &amp; Minimum Quantities</h3>
          <div className="item-edit-panel__store-row">
            <span className="item-edit-panel__store-dot" aria-hidden="true" />
            <span className="item-edit-panel__store-name">{item.storeName}</span>
          </div>
          <div className="item-edit-panel__quantities">
            <div className="item-edit-panel__quantity">
              <label className="item-edit-panel__quantity-label" htmlFor="edit-item-min-weekday">
                Weekday Min <span className="item-edit-panel__quantity-sublabel">Mon-Thu</span>
              </label>
              <CounterStepper
                id="edit-item-min-weekday"
                value={values.minWeekday}
                onChange={(value) => setValues((current) => ({ ...current, minWeekday: value }))}
              />
              {errors.minWeekday && <span className="form-field__error">{errors.minWeekday}</span>}
            </div>
            <div className="item-edit-panel__quantity">
              <label className="item-edit-panel__quantity-label" htmlFor="edit-item-min-weekend">
                Weekend Min <span className="item-edit-panel__quantity-sublabel">Fri-Sun</span>
              </label>
              <CounterStepper
                id="edit-item-min-weekend"
                value={values.minWeekend}
                onChange={(value) => setValues((current) => ({ ...current, minWeekend: value }))}
              />
              {errors.minWeekend && <span className="form-field__error">{errors.minWeekend}</span>}
            </div>
          </div>
        </div>

        <FormField label="Preferred Supplier" htmlFor="edit-item-supplier" error={errors.preferredSupplierId}>
          <SupplierCombobox
            id="edit-item-supplier"
            suppliers={suppliers}
            value={values.preferredSupplierId}
            onChange={(supplierId) => setValues((current) => ({ ...current, preferredSupplierId: supplierId }))}
            onCreate={onCreateSupplier}
            ariaLabel="Preferred supplier"
          />
        </FormField>

        <div className="item-edit-panel__auto-po">
          <div className="item-edit-panel__auto-po-text">
            <span className="item-edit-panel__auto-po-title">
              <Zap size={14} aria-hidden="true" /> Auto PO Generator
              <span className="badge badge--info item-edit-panel__auto-po-badge">Smart Replenish</span>
            </span>
            <span className="item-edit-panel__auto-po-hint">
              Automatically raise a Needs Ordering entry on the Orders tab when an End of Day count breaches this item's minimum.
            </span>
          </div>
          <Toggle
            checked={values.autoPoEnabled}
            onChange={(checked) => setValues((current) => ({ ...current, autoPoEnabled: checked }))}
            label={`${values.autoPoEnabled ? 'Disable' : 'Enable'} automatic reordering for ${item.name}`}
          />
        </div>

        <FormField label="Notes / Operational Remarks (Optional)" htmlFor="edit-item-note">
          <textarea
            id="edit-item-note"
            className="input"
            rows={2}
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder="Add internal notes, handling instructions, or supplier caveats..."
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default StoreInventoryItemEditPanel;
