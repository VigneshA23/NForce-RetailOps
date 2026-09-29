import { useEffect, useState, type FormEvent } from 'react';
import type { InventoryCategory } from '../types/inventory';
import type { StoreInventoryItemFormValues } from '../types/storeInventory';
import type { Supplier } from '../types/supplier';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import ButtonDots from './ButtonDots';

export interface StoreOption {
  id: number;
  name: string;
}

interface StoreInventoryItemFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  categories: InventoryCategory[];
  suppliers: Supplier[];
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
  categoryId: null,
  unitOfMeasurement: '',
  minWeekday: '',
  minWeekend: '',
  preferredSupplierId: null,
  note: '',
};

function StoreInventoryItemFormModal({
  isOpen,
  mode,
  categories,
  suppliers,
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
    if (!values.categoryId) nextErrors.categoryId = 'Category is required';
    if (!values.unitOfMeasurement.trim()) nextErrors.unitOfMeasurement = 'Unit is required';
    if (values.minWeekday.trim() === '' || Number(values.minWeekday) < 0) {
      nextErrors.minWeekday = 'Minimum weekday quantity is required and cannot be negative';
    }
    if (values.minWeekend.trim() !== '' && Number(values.minWeekend) < 0) {
      nextErrors.minWeekend = 'Minimum weekend quantity cannot be negative';
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
  const categoryOptions = categories.filter((c) => c.active).map((c) => ({ value: String(c.id), label: c.name }));
  const supplierOptions = [
    { value: '', label: 'No preferred supplier' },
    ...suppliers.filter((s) => s.active).map((s) => ({ value: String(s.id), label: s.name })),
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Inventory Item' : 'Edit Inventory Item'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="store-inventory-item-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : mode === 'create' ? 'Add Item' : 'Save Changes'}
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
        <FormField label="Inventory Name" htmlFor="inventory-item-name" error={errors.name}>
          <input
            id="inventory-item-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Coffee Beans, Milk"
          />
        </FormField>
        <FormField label="Category" htmlFor="inventory-item-category" error={errors.categoryId}>
          <Select
            id="inventory-item-category"
            options={categoryOptions}
            value={values.categoryId ? String(values.categoryId) : ''}
            onChange={(value) => setValues((current) => ({ ...current, categoryId: Number(value) }))}
            ariaLabel="Category"
          />
        </FormField>
        <FormField label="Unit" htmlFor="inventory-item-unit" error={errors.unitOfMeasurement}>
          <input
            id="inventory-item-unit"
            className="input"
            value={values.unitOfMeasurement}
            onChange={(event) => setValues((current) => ({ ...current, unitOfMeasurement: event.target.value }))}
            placeholder="e.g. kg, litre, box, bottle"
          />
        </FormField>
        <FormField label="Minimum Weekday Quantity" htmlFor="inventory-item-min-weekday" error={errors.minWeekday}>
          <input
            id="inventory-item-min-weekday"
            type="number"
            min={0}
            className="input"
            value={values.minWeekday}
            onChange={(event) => setValues((current) => ({ ...current, minWeekday: event.target.value }))}
            placeholder="e.g. 8"
          />
        </FormField>
        <FormField label="Minimum Weekend Quantity" htmlFor="inventory-item-min-weekend" error={errors.minWeekend}>
          <input
            id="inventory-item-min-weekend"
            type="number"
            min={0}
            className="input"
            value={values.minWeekend}
            onChange={(event) => setValues((current) => ({ ...current, minWeekend: event.target.value }))}
            placeholder="Leave blank to use weekday value"
          />
        </FormField>
        <FormField label="Preferred Supplier" htmlFor="inventory-item-supplier">
          <Select
            id="inventory-item-supplier"
            options={supplierOptions}
            value={values.preferredSupplierId != null ? String(values.preferredSupplierId) : ''}
            onChange={(value) =>
              setValues((current) => ({ ...current, preferredSupplierId: value === '' ? null : Number(value) }))
            }
            ariaLabel="Preferred supplier"
          />
        </FormField>
        <FormField label="Note (optional)" htmlFor="inventory-item-note">
          <textarea
            id="inventory-item-note"
            className="input"
            rows={2}
            value={values.note}
            onChange={(event) => setValues((current) => ({ ...current, note: event.target.value }))}
            placeholder="Any additional information about this item"
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default StoreInventoryItemFormModal;
