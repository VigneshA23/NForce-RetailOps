import { useEffect, useState, type FormEvent } from 'react';
import type { InventoryCategoryFormValues } from '../types/inventory';
import Modal from './Modal';
import FormField from './FormField';

interface InventoryCategoryFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: InventoryCategoryFormValues;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: InventoryCategoryFormValues) => void;
}

const EMPTY_VALUES: InventoryCategoryFormValues = { name: '' };

function InventoryCategoryFormModal({
  isOpen,
  mode,
  initialValues,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: InventoryCategoryFormModalProps) {
  const [values, setValues] = useState<InventoryCategoryFormValues>(initialValues ?? EMPTY_VALUES);
  const [validationError, setValidationError] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ?? EMPTY_VALUES);
      setValidationError(undefined);
    }
  }, [isOpen, initialValues]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setValidationError('Name is required');
      return;
    }
    onSubmit({ name: values.name.trim() });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Inventory Category' : 'Edit Inventory Category'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="inventory-category-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Add Category' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="inventory-category-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Category Name" htmlFor="inventory-category-name" error={validationError}>
          <input
            id="inventory-category-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues({ name: event.target.value })}
            placeholder="e.g. Dairy, Paper Goods, Cleaning Supplies"
            autoFocus
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default InventoryCategoryFormModal;
