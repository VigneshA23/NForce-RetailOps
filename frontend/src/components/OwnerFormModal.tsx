import { useEffect, useState, type FormEvent } from 'react';
import type { OwnerFormValues } from '../types/owner';
import Modal from './Modal';
import FormField from './FormField';
import './OwnerFormModal.css';

interface OwnerFormModalProps {
  isOpen: boolean;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: OwnerFormValues) => void;
}

const EMPTY_VALUES: OwnerFormValues = {
  ownerName: '',
  ownerEmail: '',
  storeName: '',
  storeLocation: '',
};

function OwnerFormModal({ isOpen, errorMessage, isSubmitting = false, onClose, onSubmit }: OwnerFormModalProps) {
  const [values, setValues] = useState<OwnerFormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof OwnerFormValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(EMPTY_VALUES);
      setErrors({});
    }
  }, [isOpen]);

  function updateField<K extends keyof OwnerFormValues>(field: K, value: OwnerFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validate(): Partial<Record<keyof OwnerFormValues, string>> {
    const nextErrors: Partial<Record<keyof OwnerFormValues, string>> = {};
    if (!values.ownerName.trim()) nextErrors.ownerName = 'Owner name is required';
    if (!values.ownerEmail.trim()) nextErrors.ownerEmail = 'Owner email is required';
    if (!values.storeName.trim()) nextErrors.storeName = 'Store name is required';
    if (!values.storeLocation.trim()) nextErrors.storeLocation = 'Store location is required';
    return nextErrors;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    onSubmit({
      ownerName: values.ownerName.trim(),
      ownerEmail: values.ownerEmail.trim(),
      storeName: values.storeName.trim(),
      storeLocation: values.storeLocation.trim(),
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Owner"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="owner-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Add Owner'}
          </button>
        </>
      }
    >
      <form id="owner-form" onSubmit={handleSubmit} noValidate>
        <div className="owner-form__grid">
          <FormField label="Owner Name" htmlFor="owner-name" error={errors.ownerName}>
            <input
              id="owner-name"
              className="input"
              value={values.ownerName}
              onChange={(event) => updateField('ownerName', event.target.value)}
              autoFocus
            />
          </FormField>

          <FormField label="Owner Email" htmlFor="owner-email" error={errors.ownerEmail}>
            <input
              id="owner-email"
              type="email"
              className="input"
              value={values.ownerEmail}
              onChange={(event) => updateField('ownerEmail', event.target.value)}
            />
          </FormField>

          <div className="form-field--full">
            <p className="owner-form__hint">A temporary password will be emailed to this address.</p>
          </div>

          <FormField label="Store Name" htmlFor="owner-store-name" error={errors.storeName}>
            <input
              id="owner-store-name"
              className="input"
              value={values.storeName}
              onChange={(event) => updateField('storeName', event.target.value)}
              placeholder="e.g. Downtown Ice Cream Co."
            />
          </FormField>

          <FormField label="Store Location" htmlFor="owner-store-location" error={errors.storeLocation}>
            <input
              id="owner-store-location"
              className="input"
              value={values.storeLocation}
              onChange={(event) => updateField('storeLocation', event.target.value)}
              placeholder="e.g. Downtown, Austin TX"
            />
          </FormField>
        </div>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default OwnerFormModal;
