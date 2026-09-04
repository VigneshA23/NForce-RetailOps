import { useEffect, useState, type FormEvent } from 'react';
import { getNextStoreCode } from '../api/owners';
import type { CreateStoreValues } from '../types/superAdminStore';
import Modal from './Modal';
import FormField from './FormField';
import './AssignStoreModal.css';

interface AddStoreModalProps {
  isOpen: boolean;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CreateStoreValues) => void;
}

const EMPTY_VALUES: CreateStoreValues = { name: '', location: '' };

// Creates a store with no owner -- it shows up as an "existing store" pick
// when a new Owner is created later.
function AddStoreModal({ isOpen, errorMessage, isSubmitting = false, onClose, onSubmit }: AddStoreModalProps) {
  const [values, setValues] = useState<CreateStoreValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateStoreValues, string>>>({});
  const [nextStoreCode, setNextStoreCode] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY_VALUES);
      setErrors({});
      setNextStoreCode(null);
      getNextStoreCode()
        .then(setNextStoreCode)
        .catch(() => setNextStoreCode(null));
    }
  }, [isOpen]);

  function updateField<K extends keyof CreateStoreValues>(field: K, value: CreateStoreValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof CreateStoreValues, string>> = {};
    if (!values.name.trim()) nextErrors.name = 'Store name is required';
    if (!values.location.trim()) nextErrors.location = 'Store location is required';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({ name: values.name.trim(), location: values.location.trim() });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Store"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-store-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Store'}
          </button>
        </>
      }
    >
      <form id="add-store-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Store Name" htmlFor="add-store-name" error={errors.name}>
          <input
            id="add-store-name"
            className="input"
            value={values.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="e.g. Downtown Ice Cream Co."
            autoFocus
          />
        </FormField>

        <FormField label="Store Location" htmlFor="add-store-location" error={errors.location}>
          <input
            id="add-store-location"
            className="input"
            value={values.location}
            onChange={(event) => updateField('location', event.target.value)}
            placeholder="e.g. Downtown, Austin TX"
          />
        </FormField>

        <p className="assign-store-modal__hint">
          {nextStoreCode != null ? (
            <>
              This store will be assigned Store ID <strong>#{nextStoreCode}</strong>.
            </>
          ) : (
            'A unique Store ID will be assigned automatically.'
          )}{' '}
          It won't have an owner until one is assigned or created for it.
        </p>

        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default AddStoreModal;
