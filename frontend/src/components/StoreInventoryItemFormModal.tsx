import { useEffect, useState, type FormEvent } from 'react';
import { Plus } from 'lucide-react';
import { buildFixedCategoryOptions, type StoreInventoryItemFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import Modal from './Modal';
import { isQtyInputAllowed, isWholeNumberUnit, parseQty, qtyRuleHint } from '../utils/quantity';
import FormField from './FormField';
import UnitSelect from './UnitSelect';
import CategoryCombobox from './CategoryCombobox';
import MultiSelect from './MultiSelect';
import SupplierCombobox from './SupplierCombobox';
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
  // Leaves the item form and opens the Suppliers page to add one there
  // (store assignment and all). Omitted for Owner/Admin, which only has read
  // access to suppliers -- the field then offers no "Add new supplier" at all.
  onRequestCreateSupplier?: () => void;
  // The categories usable here -- Owner/Admin's store assignment from Super
  // Admin. Ignored when getCategoriesForStores is given.
  restrictedCategories?: string[];
  // Leaves the item form and opens the Categories page to add one there.
  // Omitted for Owner/Admin, same reasoning as onRequestCreateSupplier.
  onRequestCreateCategory?: () => void;
  // Super Admin's create form only: recomputes the usable categories/
  // suppliers whenever the selected stores change (a store's assignment can
  // differ from another's), from the already-loaded catalogs -- no fetch
  // needed. Owner/Admin and the single-store edit panel use the plain
  // suppliers/restrictedCategories props instead, since their store can't
  // change within the form.
  getCategoriesForStores?: (storeIds: number[]) => string[];
  getSuppliersForStores?: (storeIds: number[]) => Supplier[];
  // Super Admin only: shows "Add new unit" in the unit dropdown.
  canAddUnit?: boolean;
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
  storeIds: [],
  name: '',
  category: '',
  unitOfMeasurement: '',
  minWeekday: '',
  minWeekend: '',
  preferredSupplierId: null,
  note: '',
  imageId: null,
  imagePhotoId: null,
  imagePreviewUrl: null,
  removeImage: false,
};

function StoreInventoryItemFormModal({
  isOpen,
  mode,
  suppliers,
  onRequestCreateSupplier,
  restrictedCategories = [],
  onRequestCreateCategory,
  getCategoriesForStores,
  getSuppliersForStores,
  canAddUnit = false,
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

  const selectedStoreIds = values.storeIds ?? [];

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ?? EMPTY_VALUES);
      setErrors({});
    }
  }, [isOpen, initialValues]);

  function changeStores(ids: number[]) {
    // The category and supplier lists depend on the stores, so a choice made
    // for a different selection is cleared rather than silently kept.
    setValues((current) => ({ ...current, storeIds: ids, storeId: ids[0] ?? null, category: '', preferredSupplierId: null }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (showStoreField && selectedStoreIds.length === 0) nextErrors.storeId = 'Select at least one store';
    if (!values.category.trim()) nextErrors.category = 'Category is required';
    if (!values.name.trim()) nextErrors.name = 'Name is required';
    if (!values.unitOfMeasurement.trim()) nextErrors.unitOfMeasurement = 'Unit is required';
    if (values.minWeekday.trim() === '' || (parseQty(values.minWeekday, values.unitOfMeasurement) === null)) {
      nextErrors.minWeekday = `Enter a minimum weekday quantity: ${qtyRuleHint(values.unitOfMeasurement)}`;
    }
    if (values.minWeekend.trim() !== '' && (parseQty(values.minWeekend, values.unitOfMeasurement) === null)) {
      nextErrors.minWeekend = `Enter a weekend quantity: ${qtyRuleHint(values.unitOfMeasurement)}`;
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

  const categoryOptions = buildFixedCategoryOptions(
    getCategoriesForStores ? getCategoriesForStores(selectedStoreIds) : restrictedCategories,
    values.category,
  );
  const effectiveSuppliers = getSuppliersForStores ? getSuppliersForStores(selectedStoreIds) : suppliers;
  const storeOptions = stores.map((s) => ({ id: s.id, label: s.name }));

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
            onRequestCreate={onRequestCreateCategory}
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
          <UnitSelect
            id="inventory-item-unit"
            value={values.unitOfMeasurement}
            savedUnit={initialValues?.unitOfMeasurement ?? ''}
            onChange={(value) => setValues((current) => ({ ...current, unitOfMeasurement: value }))}
            canAddUnit={canAddUnit}
          />
        </FormField>
        <div className="store-inventory-item-form__row">
          <FormField label="Min Par Level (Weekday)" htmlFor="inventory-item-min-weekday" error={errors.minWeekday}>
            <input
              id="inventory-item-min-weekday"
              type="text"
              inputMode={isWholeNumberUnit(values.unitOfMeasurement) ? 'numeric' : 'decimal'}
              className="input"
              value={values.minWeekday}
              onChange={(event) => {
                if (isQtyInputAllowed(event.target.value, values.unitOfMeasurement)) setValues((current) => ({ ...current, minWeekday: event.target.value }));
              }}
              placeholder="e.g. 5"
            />
          </FormField>
          <FormField label="Weekend Par Cushion" htmlFor="inventory-item-min-weekend" error={errors.minWeekend}>
            <input
              id="inventory-item-min-weekend"
              type="text"
              inputMode={isWholeNumberUnit(values.unitOfMeasurement) ? 'numeric' : 'decimal'}
              className="input"
              value={values.minWeekend}
              onChange={(event) => {
                if (isQtyInputAllowed(event.target.value, values.unitOfMeasurement)) setValues((current) => ({ ...current, minWeekend: event.target.value }));
              }}
              placeholder="e.g. 8"
            />
          </FormField>
        </div>
        <FormField label="Preferred Supplier" htmlFor="inventory-item-supplier" error={errors.preferredSupplierId}>
          <SupplierCombobox
            id="inventory-item-supplier"
            suppliers={effectiveSuppliers}
            value={values.preferredSupplierId}
            onChange={(supplierId) => setValues((current) => ({ ...current, preferredSupplierId: supplierId }))}
            onRequestCreate={onRequestCreateSupplier}
            ariaLabel="Preferred supplier"
            isEditingExisting={mode === 'edit'}
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
