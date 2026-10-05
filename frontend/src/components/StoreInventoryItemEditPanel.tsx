import { useEffect, useState, type FormEvent } from 'react';
import { Plus, Zap } from 'lucide-react';
import type { StoreInventoryItem, StoreInventoryItemFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import type { InventoryCategory } from '../types/inventoryCategory';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import SupplierCombobox from './SupplierCombobox';
import InventoryCategoryFormModal from './InventoryCategoryFormModal';
import CounterStepper from './CounterStepper';
import Toggle from './Toggle';
import ItemIcon from './ItemIcon';
import ButtonDots from './ButtonDots';
import { inventoryUnitOptionsFor } from '../utils/inventoryUnits';
import './StoreInventoryItemEditPanel.css';

interface StoreInventoryItemEditPanelProps {
  isOpen: boolean;
  item: StoreInventoryItem;
  categories: InventoryCategory[];
  onCreateCategory: (name: string) => Promise<InventoryCategory>;
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
    categoryId: item.categoryId,
    name: item.name,
    unitOfMeasurement: item.unitOfMeasurement,
    minWeekday: item.minWeekday != null ? String(item.minWeekday) : '',
    minWeekend: item.minWeekend != null ? String(item.minWeekend) : '',
    preferredSupplierId: item.preferredSupplierId,
    note: item.note ?? '',
    autoPoEnabled: item.autoPoEnabled,
  };
}

function StoreInventoryItemEditPanel({
  isOpen,
  item,
  categories,
  onCreateCategory,
  suppliers,
  onCreateSupplier,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: StoreInventoryItemEditPanelProps) {
  const [values, setValues] = useState<StoreInventoryItemFormValues>(toFormValues(item));
  const [errors, setErrors] = useState<Partial<Record<keyof StoreInventoryItemFormValues, string>>>({});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [isCategorySubmitting, setIsCategorySubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setValues(toFormValues(item));
      setErrors({});
      setIsCategoryModalOpen(false);
      setCategoryError(null);
    }
    // Deliberately keyed on item.id, not the whole item object -- the 60s
    // background poll in StoreInventory.tsx replaces every item reference on
    // each refresh, and resetting in-progress edits whenever that happens
    // (rather than only when switching to a different item) would be jarring.
  }, [isOpen, item.id]);

  async function handleCreateCategory(name: string) {
    setIsCategorySubmitting(true);
    setCategoryError(null);
    try {
      const created = await onCreateCategory(name);
      setValues((current) => ({ ...current, categoryId: created.id }));
      setIsCategoryModalOpen(false);
    } catch (error) {
      setCategoryError(error instanceof Error ? error.message : 'Failed to add category');
    } finally {
      setIsCategorySubmitting(false);
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.categoryId) nextErrors.categoryId = 'Category is required';
    if (!values.name.trim()) nextErrors.name = 'Name is required';
    if (!values.unitOfMeasurement.trim()) nextErrors.unitOfMeasurement = 'Unit is required';
    if (values.minWeekday.trim() === '' || Number(values.minWeekday) < 0) {
      nextErrors.minWeekday = 'Weekday min is required and cannot be negative';
    }
    if (values.minWeekend.trim() !== '' && Number(values.minWeekend) < 0) {
      nextErrors.minWeekend = 'Weekend min cannot be negative';
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
      titleIcon={<ItemIcon id={item.id} name={item.name} size="sm" />}
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

        <div className="item-edit-panel__row">
          <div className={`form-field${errors.categoryId ? ' form-field--error' : ''}`}>
            <div className="item-edit-panel__category-label-row">
              <label className="form-field__label" htmlFor="edit-item-category">Category</label>
              <button type="button" className="item-edit-panel__add-category" onClick={() => setIsCategoryModalOpen(true)}>
                <Plus size={12} aria-hidden="true" /> Add New
              </button>
            </div>
            <Select
              id="edit-item-category"
              options={categories.filter((c) => c.active).map((c) => ({ value: String(c.id), label: c.name }))}
              value={values.categoryId ? String(values.categoryId) : ''}
              onChange={(value) => setValues((current) => ({ ...current, categoryId: Number(value) }))}
              ariaLabel="Category"
              placeholder="Select category..."
            />
            {errors.categoryId && <span className="form-field__error">{errors.categoryId}</span>}
          </div>
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

        <FormField label="Preferred Supplier" htmlFor="edit-item-supplier">
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
      <InventoryCategoryFormModal
        isOpen={isCategoryModalOpen}
        errorMessage={categoryError}
        isSubmitting={isCategorySubmitting}
        onClose={() => setIsCategoryModalOpen(false)}
        onSubmit={(categoryValues) => handleCreateCategory(categoryValues.name)}
      />
    </Modal>
  );
}

export default StoreInventoryItemEditPanel;
