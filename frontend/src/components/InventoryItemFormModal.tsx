import { useEffect, useState, type FormEvent } from 'react';
import type { InventoryCategory, InventoryItemFormValues } from '../types/inventory';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';

interface InventoryItemFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  categories: InventoryCategory[];
  initialValues?: InventoryItemFormValues;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: InventoryItemFormValues) => void;
}

const EMPTY_VALUES: InventoryItemFormValues = { categoryId: null, name: '', unitOfMeasurement: '' };

function InventoryItemFormModal({
  isOpen,
  mode,
  categories,
  initialValues,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: InventoryItemFormModalProps) {
  const [values, setValues] = useState<InventoryItemFormValues>(initialValues ?? EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof InventoryItemFormValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ?? EMPTY_VALUES);
      setErrors({});
    }
  }, [isOpen, initialValues]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!values.categoryId) nextErrors.categoryId = 'Category is required';
    if (!values.name.trim()) nextErrors.name = 'Name is required';
    if (!values.unitOfMeasurement.trim()) nextErrors.unitOfMeasurement = 'Unit is required';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    onSubmit({
      categoryId: values.categoryId,
      name: values.name.trim(),
      unitOfMeasurement: values.unitOfMeasurement.trim(),
    });
  }

  const categoryOptions = categories.map((c) => ({ value: String(c.id), label: c.name }));

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
          <button type="submit" form="inventory-item-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Add Item' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="inventory-item-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Category" htmlFor="inventory-item-category" error={errors.categoryId}>
          <Select
            id="inventory-item-category"
            options={categoryOptions}
            value={values.categoryId ? String(values.categoryId) : ''}
            onChange={(value) => setValues((current) => ({ ...current, categoryId: Number(value) }))}
            ariaLabel="Category"
          />
        </FormField>
        <FormField label="Item Name" htmlFor="inventory-item-name" error={errors.name}>
          <input
            id="inventory-item-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
            placeholder="e.g. Milk, Waffle Cones"
          />
        </FormField>
        <FormField label="Unit of Measurement" htmlFor="inventory-item-unit" error={errors.unitOfMeasurement}>
          <input
            id="inventory-item-unit"
            className="input"
            value={values.unitOfMeasurement}
            onChange={(event) => setValues((current) => ({ ...current, unitOfMeasurement: event.target.value }))}
            placeholder="e.g. bottles, boxes, lbs"
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default InventoryItemFormModal;
