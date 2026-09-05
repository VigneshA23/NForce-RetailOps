import { useEffect, useState, type FormEvent } from 'react';
import type { UpdateOwnerValues } from '../types/owner';
import Modal from './Modal';
import FormField from './FormField';

interface OwnerEditModalProps {
  isOpen: boolean;
  initialValues?: { ownerName: string; ownerEmail: string };
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: UpdateOwnerValues) => void;
}

interface FormState {
  ownerName: string;
  ownerEmail: string;
}

const EMPTY: FormState = { ownerName: '', ownerEmail: '' };

function OwnerEditModal({ isOpen, initialValues, errorMessage, isSubmitting = false, onClose, onSubmit }: OwnerEditModalProps) {
  const [values, setValues] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues(initialValues ?? EMPTY);
    setErrors({});
  }, [isOpen, initialValues]);

  function updateField<K extends keyof FormState>(field: K, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validate(): Partial<Record<keyof FormState, string>> {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!values.ownerName.trim()) next.ownerName = 'Name is required';
    if (!values.ownerEmail.trim()) next.ownerEmail = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.ownerEmail.trim())) next.ownerEmail = 'Enter a valid email';
    return next;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit({ ownerName: values.ownerName.trim(), ownerEmail: values.ownerEmail.trim() });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Owner"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="owner-edit-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="owner-edit-form" onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <FormField label="Owner Name" htmlFor="edit-owner-name" error={errors.ownerName}>
            <input
              id="edit-owner-name"
              className="input"
              value={values.ownerName}
              onChange={(event) => updateField('ownerName', event.target.value)}
              autoFocus
            />
          </FormField>

          <FormField label="Owner Email" htmlFor="edit-owner-email" error={errors.ownerEmail}>
            <input
              id="edit-owner-email"
              type="email"
              className="input"
              value={values.ownerEmail}
              onChange={(event) => updateField('ownerEmail', event.target.value)}
            />
          </FormField>

          {errorMessage && <p className="form-field__error">{errorMessage}</p>}
        </div>
      </form>
    </Modal>
  );
}

export default OwnerEditModal;
