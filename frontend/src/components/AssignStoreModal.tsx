import { useEffect, useState, type FormEvent } from 'react';
import type { AssignStoreValues } from '../types/owner';
import Modal from './Modal';
import FormField from './FormField';

interface AssignStoreModalProps {
  isOpen: boolean;
  ownerName?: string;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: AssignStoreValues) => void;
}

const EMPTY_VALUES: AssignStoreValues = { storeName: '', storeLocation: '' };

function AssignStoreModal({
  isOpen,
  ownerName,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: AssignStoreModalProps) {
  const [values, setValues] = useState<AssignStoreValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof AssignStoreValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY_VALUES);
      setErrors({});
    }
  }, [isOpen]);

  function updateField<K extends keyof AssignStoreValues>(field: K, value: AssignStoreValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof AssignStoreValues, string>> = {};
    if (!values.storeName.trim()) nextErrors.storeName = 'Store name is required';
    if (!values.storeLocation.trim()) nextErrors.storeLocation = 'Store location is required';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      storeName: values.storeName.trim(),
      storeLocation: values.storeLocation.trim(),
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={ownerName ? `Add Store for ${ownerName}` : 'Add Store'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="assign-store-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Store'}
          </button>
        </>
      }
    >
      <form id="assign-store-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Store Name" htmlFor="assign-store-name" error={errors.storeName}>
          <input
            id="assign-store-name"
            className="input"
            value={values.storeName}
            onChange={(event) => updateField('storeName', event.target.value)}
            placeholder="e.g. Downtown Ice Cream Co."
            autoFocus
          />
        </FormField>

        <FormField label="Store Location" htmlFor="assign-store-location" error={errors.storeLocation}>
          <input
            id="assign-store-location"
            className="input"
            value={values.storeLocation}
            onChange={(event) => updateField('storeLocation', event.target.value)}
            placeholder="e.g. Downtown, Austin TX"
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default AssignStoreModal;
