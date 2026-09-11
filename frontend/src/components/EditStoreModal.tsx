import { useEffect, useState, type FormEvent } from 'react';
import type { CreateStoreValues } from '../types/superAdminStore';
import Modal from './Modal';
import FormField from './FormField';
import './AssignStoreModal.css';

interface EditStoreModalProps {
  isOpen: boolean;
  initialValues?: CreateStoreValues;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CreateStoreValues) => void;
}

const EMPTY_VALUES: CreateStoreValues = { name: '', location: '' };

function EditStoreModal({ isOpen, initialValues, errorMessage, isSubmitting = false, onClose, onSubmit }: EditStoreModalProps) {
  const [values, setValues] = useState<CreateStoreValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateStoreValues, string>>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues(initialValues ?? EMPTY_VALUES);
    setErrors({});
  }, [isOpen, initialValues]);

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
      title="Edit Store"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-store-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="edit-store-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Store Name" htmlFor="edit-store-name" error={errors.name}>
          <input
            id="edit-store-name"
            className="input"
            value={values.name}
            onChange={(event) => updateField('name', event.target.value)}
            placeholder="e.g. Downtown Ice Cream Co."
            autoFocus
          />
        </FormField>

        <FormField label="Store Location" htmlFor="edit-store-location" error={errors.location}>
          <input
            id="edit-store-location"
            className="input"
            value={values.location}
            onChange={(event) => updateField('location', event.target.value)}
            placeholder="e.g. Downtown, Austin TX"
          />
        </FormField>

        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default EditStoreModal;
