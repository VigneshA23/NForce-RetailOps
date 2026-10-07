import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { INVENTORY_ITEM_CATEGORY_OPTIONS, type InventoryItemCategory, type StoreInventoryItemFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import SupplierCombobox from './SupplierCombobox';
import { inventoryUnitOptionsFor } from '../utils/inventoryUnits';
import ButtonDots from './ButtonDots';
import './StoreInventoryItemFormModal.css';
import InventoryImagePicker from './InventoryImagePicker';

export interface StoreOption {
  id: number;
  name: string;
}

interface StoreInventoryItemFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  suppliers: Supplier[];
  // Backs the supplier field's inline "Add New Supplier" option.
  onCreateSupplier: (name: string) => Promise<Supplier>;
  onDeleteSupplier?: (supplier: Supplier) => Promise<void>;
  // Only Super Admin's page passes stores + true here -- Owner/Admin's own
  // store is derived server-side, so their form never shows this field.
  stores?: StoreOption[];
  showStoreField?: boolean;
  initialValues?: StoreInventoryItemFormValues;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: StoreInventoryItemFormValues) => void;
}

const EMPTY_VALUES: StoreInventoryItemFormValues = {
  storeId: null,
  name: '',
  category: 'INGREDIENTS',
  unitOfMeasurement: '',
  minWeekday: '',
  minWeekend: '',
  preferredSupplierId: null,
  note: '',
  autoPoEnabled: true,
  imageId: null,
  imagePhotoId: null,
  imagePreviewUrl: null,
  removeImage: false,
};

function StoreInventoryItemFormModal({
  isOpen,
  mode,
  suppliers,
  onCreateSupplier,
  onDeleteSupplier,
  stores = [],
  showStoreField = false,
  initialValues,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: StoreInventoryItemFormModalProps) {
  const [values, setValues] = useState<StoreInventoryItemFormValues>(initialValues ?? EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof StoreInventoryItemFormValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ?? EMPTY_VALUES);
      setErrors({});
    }
  }, [isOpen, initialValues]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (showStoreField && !values.storeId) nextErrors.storeId = 'Store is required';
    if (!values.name.trim()) nextErrors.name = 'Name is required';
    if (!values.unitOfMeasurement.trim()) nextErrors.unitOfMeasurement = 'Unit is required';
    if (values.minWeekday.trim() === '' || Number(values.minWeekday) < 0) {
      nextErrors.minWeekday = 'Minimum weekday quantity is required and cannot be negative';
    }
    if (values.minWeekend.trim() !== '' && Number(values.minWeekend) < 0) {
      nextErrors.minWeekend = 'Minimum weekend quantity cannot be negative';
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

  const storeOptions = stores.map((s) => ({ value: String(s.id), label: s.name }));
  const unitOptions = inventoryUnitOptionsFor(initialValues?.unitOfMeasurement ?? '');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="store-inventory-item-form"
      titleIcon={<span className="store-inventory-item-form__icon-tile"><Plus size={18} /></span>}
      title={mode === 'create' ? 'Add New Inventory Item' : 'Edit Inventory Item'}
      subtitle="Configure catalog item details, categorization, and units."
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="store-inventory-item-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : mode === 'create' ? (<><Plus size={16} /> Add to Catalog</>) : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="store-inventory-item-form" onSubmit={handleSubmit} noValidate>
        {showStoreField && (
          <FormField label="Store" htmlFor="inventory-item-store" error={errors.storeId}>
            <Select
              id="inventory-item-store"
              options={storeOptions}
              value={values.storeId ? String(values.storeId) : ''}
              onChange={(value) => setValues((current) => ({ ...current, storeId: Number(value) }))}
              ariaLabel="Store"
              placeholder="Select a store"
            />
          </FormField>
        )}
        <FormField label="Category" htmlFor="inventory-item-category">
          <Select
            id="inventory-item-category"
            options={INVENTORY_ITEM_CATEGORY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            value={values.category}
            onChange={(value) => setValues((current) => ({ ...current, category: value as InventoryItemCategory }))}
            ariaLabel="Category"
            indicator="radio"
          />
        </FormField>
        <FormField label="Item Name" htmlFor="inventory-item-name" error={errors.name}>
          <input
            id="inventory-item-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Whole Milk 1 Gallon, Chocolate Chip Cookie Dough, Strawberry Syrup"
          />
        </FormField>
        <FormField label="Display Image (optional)" htmlFor="inventory-item-image">
          <InventoryImagePicker
            id="inventory-item-image"
            itemName={values.name}
            value={values}
            onChange={(image) => setValues((current) => ({ ...current, ...image }))}
          />
        </FormField>
        <FormField label="Unit of Measurement" htmlFor="inventory-item-unit" error={errors.unitOfMeasurement}>
          <Select
            id="inventory-item-unit"
            options={unitOptions}
            value={values.unitOfMeasurement}
            onChange={(value) => setValues((current) => ({ ...current, unitOfMeasurement: value }))}
            ariaLabel="Unit"
            placeholder="Select unit..."
            indicator="radio"
          />
        </FormField>
        <div className="store-inventory-item-form__row">
          <FormField label="Min Par Level (Weekday)" htmlFor="inventory-item-min-weekday" error={errors.minWeekday}>
            <input
              id="inventory-item-min-weekday"
              type="number"
              min={0}
              className="input"
              value={values.minWeekday}
              onChange={(event) => setValues((current) => ({ ...current, minWeekday: event.target.value }))}
              placeholder="e.g. 5"
            />
          </FormField>
          <FormField label="Weekend Par Cushion" htmlFor="inventory-item-min-weekend" error={errors.minWeekend}>
            <input
              id="inventory-item-min-weekend"
              type="number"
              min={0}
              className="input"
              value={values.minWeekend}
              onChange={(event) => setValues((current) => ({ ...current, minWeekend: event.target.value }))}
              placeholder="e.g. 8"
            />
          </FormField>
        </div>
        <FormField label="Preferred Supplier" htmlFor="inventory-item-supplier" error={errors.preferredSupplierId}>
          <SupplierCombobox
            id="inventory-item-supplier"
            suppliers={suppliers}
            value={values.preferredSupplierId}
            onChange={(supplierId) => setValues((current) => ({ ...current, preferredSupplierId: supplierId }))}
            onCreate={onCreateSupplier}
            onDelete={onDeleteSupplier}
            ariaLabel="Preferred supplier"
          />
        </FormField>
        <FormField label="Additional Notes" htmlFor="inventory-item-note">
          <textarea
            id="inventory-item-note"
            className="input"
            rows={2}
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder="e.g. Special storage requirements, vendor batch minimums, seasonal variations..."
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default StoreInventoryItemFormModal;
