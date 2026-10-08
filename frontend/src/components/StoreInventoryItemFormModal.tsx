import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { buildCategoryOptions, categoryLabel, type StoreInventoryItemFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import Modal from './Modal';
import { parseQty } from '../utils/quantity';
import FormField from './FormField';
import Select from './Select';
import CategoryCombobox from './CategoryCombobox';
import MultiSelect from './MultiSelect';
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
  // Categories already used by existing items, offered alongside the built-in
  // ones so a category added once can be picked again.
  existingCategories?: (string | null)[];
  // Only Super Admin's page passes stores + true here -- Owner/Admin's own
  // store is derived server-side, so their form never shows this field.
  stores?: StoreOption[];
  showStoreField?: boolean;
  // With the store field: fetches the categories common to the selected
  // stores, which then replace the built-in category list.
  loadCategories?: (storeIds: number[]) => Promise<string[]>;
  initialValues?: StoreInventoryItemFormValues;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: StoreInventoryItemFormValues) => void;
}

const EMPTY_VALUES: StoreInventoryItemFormValues = {
  storeId: null,
  storeIds: [],
  name: '',
  category: '',
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

// Categories shared by the selected stores, plus the one currently chosen so a
// freshly typed category stays visible in the list.
function buildStoreCategoryOptions(categories: string[], current: string) {
  const options = categories.map((c) => ({ value: c, label: categoryLabel(c) }));
  if (current && !categories.some((c) => c.toLowerCase() === current.toLowerCase())) {
    options.push({ value: current, label: categoryLabel(current) });
  }
  return options;
}

function StoreInventoryItemFormModal({
  isOpen,
  mode,
  suppliers,
  onCreateSupplier,
  existingCategories = [],
  stores = [],
  showStoreField = false,
  loadCategories,
  initialValues,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: StoreInventoryItemFormModalProps) {
  const [values, setValues] = useState<StoreInventoryItemFormValues>(initialValues ?? EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof StoreInventoryItemFormValues, string>>>({});

  const [storeCategories, setStoreCategories] = useState<string[]>([]);
  const selectedStoreIds = values.storeIds ?? [];
  const storeIdsKey = selectedStoreIds.join(',');

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ?? EMPTY_VALUES);
      setErrors({});
    }
  }, [isOpen, initialValues]);

  // Common categories of whichever stores are currently selected.
  useEffect(() => {
    if (!isOpen || !showStoreField || !loadCategories || storeIdsKey === '') {
      setStoreCategories([]);
      return;
    }
    let cancelled = false;
    loadCategories(storeIdsKey.split(',').map(Number))
      .then((categories) => { if (!cancelled) setStoreCategories(categories); })
      .catch(() => { if (!cancelled) setStoreCategories([]); });
    return () => { cancelled = true; };
  }, [isOpen, showStoreField, loadCategories, storeIdsKey]);

  function changeStores(ids: number[]) {
    // The category list depends on the stores, so a category picked for a
    // different selection is cleared rather than silently kept.
    setValues((current) => ({ ...current, storeIds: ids, storeId: ids[0] ?? null, category: '' }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (showStoreField && selectedStoreIds.length === 0) nextErrors.storeId = 'Select at least one store';
    if (!values.category.trim()) nextErrors.category = 'Category is required';
    if (!values.name.trim()) nextErrors.name = 'Name is required';
    if (!values.unitOfMeasurement.trim()) nextErrors.unitOfMeasurement = 'Unit is required';
    if (values.minWeekday.trim() === '' || (parseQty(values.minWeekday) === null)) {
      nextErrors.minWeekday = 'Enter a minimum weekday quantity (0 or more, up to 2 decimals)';
    }
    if (values.minWeekend.trim() !== '' && (parseQty(values.minWeekend) === null)) {
      nextErrors.minWeekend = 'Enter a valid weekend quantity (0 or more, up to 2 decimals)';
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

  const categoryOptions = showStoreField
    ? buildStoreCategoryOptions(storeCategories, values.category)
    : buildCategoryOptions(existingCategories, [values.category]);
  const storeOptions = stores.map((s) => ({ id: s.id, label: s.name }));
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
        <FormField label="Item Name" htmlFor="inventory-item-name" error={errors.name}>
          <input
            id="inventory-item-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Whole Milk 1 Gallon, Chocolate Chip Cookie Dough, Strawberry Syrup"
          />
        </FormField>
        {showStoreField && (
          <FormField label="Stores" htmlFor="inventory-item-store" error={errors.storeId}>
            <MultiSelect
              id="inventory-item-store"
              options={storeOptions}
              value={selectedStoreIds}
              onChange={changeStores}
              placeholder="Select one or more stores"
              searchPlaceholder="Search stores..."
              allSelectedLabel="All stores"
            />
            <button
              type="button"
              className="btn btn--text btn--sm"
              onClick={() => changeStores(stores.map((s) => s.id))}
              disabled={stores.length === 0 || selectedStoreIds.length === stores.length}
            >
              Select all stores
            </button>
          </FormField>
        )}
        <FormField label="Category" htmlFor="inventory-item-category" error={errors.category}>
          <CategoryCombobox
            id="inventory-item-category"
            options={categoryOptions}
            value={values.category}
            onChange={(category) => setValues((current) => ({ ...current, category }))}
            ariaLabel="Category"
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
          />
        </FormField>
        <div className="store-inventory-item-form__row">
          <FormField label="Min Par Level (Weekday)" htmlFor="inventory-item-min-weekday" error={errors.minWeekday}>
            <input
              id="inventory-item-min-weekday"
              type="number"
              min={0}
              step="any"
              inputMode="decimal"
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
              step="any"
              inputMode="decimal"
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
