import { useEffect, useState, type FormEvent } from 'react';
import type { SupplierFormValues } from '../types/supplier';
import Modal from './Modal';
import FormField from './FormField';

interface SupplierFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: SupplierFormValues;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: SupplierFormValues) => void;
}

const EMPTY_VALUES: SupplierFormValues = { name: '' };

function SupplierFormModal({
  isOpen,
  mode,
  initialValues,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: SupplierFormModalProps) {
  const [values, setValues] = useState<SupplierFormValues>(initialValues ?? EMPTY_VALUES);
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
      title={mode === 'create' ? 'Add Supplier' : 'Edit Supplier'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="supplier-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Add Supplier' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="supplier-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Supplier Name" htmlFor="supplier-name" error={validationError}>
          <input
            id="supplier-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues({ name: event.target.value })}
            placeholder="e.g. Walmart, Sam's Club"
            autoFocus
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default SupplierFormModal;
