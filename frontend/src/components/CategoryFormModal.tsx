import { useEffect, useState, type FormEvent } from 'react';
import type { CategoryFormValues } from '../types/category';
import Modal from './Modal';
import FormField from './FormField';

interface CategoryFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: CategoryFormValues;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CategoryFormValues) => void;
}

const EMPTY_VALUES: CategoryFormValues = { name: '' };

function CategoryFormModal({
  isOpen,
  mode,
  initialValues,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: CategoryFormModalProps) {
  const [values, setValues] = useState<CategoryFormValues>(initialValues ?? EMPTY_VALUES);
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
      title={mode === 'create' ? 'Add Category' : 'Edit Category'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="category-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Add Category' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="category-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Category Name" htmlFor="category-name" error={validationError}>
          <input
            id="category-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues({ name: event.target.value })}
            placeholder="e.g. Opening, Cleaning, Closing"
            autoFocus
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default CategoryFormModal;
