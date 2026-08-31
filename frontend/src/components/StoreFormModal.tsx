import { useEffect, useState, type FormEvent } from 'react';
import type { OwnerStoreFormValues } from '../types/ownerStore';
import Modal from './Modal';
import FormField from './FormField';

interface StoreFormModalProps {
  isOpen: boolean;
  initialValues?: OwnerStoreFormValues;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: OwnerStoreFormValues) => void;
}

const EMPTY_VALUES: OwnerStoreFormValues = { name: '' };

function StoreFormModal({
  isOpen,
  initialValues,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: StoreFormModalProps) {
  const [values, setValues] = useState<OwnerStoreFormValues>(initialValues ?? EMPTY_VALUES);
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
      title="Edit Store"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="store-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="store-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Store Name" htmlFor="store-name" error={validationError}>
          <input
            id="store-name"
            className="input"
            value={values.name}
            onChange={(event) => setValues({ name: event.target.value })}
            placeholder="e.g. Downtown Ice Cream Co."
            autoFocus
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default StoreFormModal;
