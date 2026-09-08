import { useEffect, useState, type FormEvent } from 'react';
import { getNextStoreCode, getReassignableStores } from '../api/owners';
import type { AddOwnerValues, OwnerStoreMode, ReassignableStore } from '../types/owner';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import './OwnerFormModal.css';

type OwnerGender = 'Male' | 'Female' | 'Non-binary';

const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Non-binary', label: 'Non-binary' },
];

interface OwnerFormModalProps {
  isOpen: boolean;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: AddOwnerValues) => void;
}

interface FormState {
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  ownerGender: OwnerGender | '';
  storeMode: OwnerStoreMode;
  storeName: string;
  storeLocation: string;
  existingStoreId: number | null;
}

const EMPTY_VALUES: FormState = {
  ownerName: '',
  ownerEmail: '',
  ownerPhone: '',
  ownerGender: '',
  storeMode: 'new',
  storeName: '',
  storeLocation: '',
  existingStoreId: null,
};

const STORE_MODE_OPTIONS = [
  { value: 'new', label: 'Create a new store' },
  { value: 'existing', label: 'Assign an existing store' },
  { value: 'none', label: 'No store yet' },
];

function OwnerFormModal({ isOpen, errorMessage, isSubmitting = false, onClose, onSubmit }: OwnerFormModalProps) {
  const [values, setValues] = useState<FormState>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [nextStoreCode, setNextStoreCode] = useState<number | null>(null);
  const [reassignableStores, setReassignableStores] = useState<ReassignableStore[]>([]);
  const [reassignableLoading, setReassignableLoading] = useState(false);
  const [reassignableError, setReassignableError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValues(EMPTY_VALUES);
    setErrors({});

    setNextStoreCode(null);
    getNextStoreCode()
      .then(setNextStoreCode)
      .catch(() => setNextStoreCode(null));

    setReassignableStores([]);
    setReassignableError(null);
    setReassignableLoading(true);
    getReassignableStores()
      .then(setReassignableStores)
      .catch((error) => setReassignableError(error instanceof Error ? error.message : 'Failed to load stores'))
      .finally(() => setReassignableLoading(false));
  }, [isOpen]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validate(): Partial<Record<keyof FormState, string>> {
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (!values.ownerName.trim()) nextErrors.ownerName = 'Name is required';
    if (!values.ownerEmail.trim()) nextErrors.ownerEmail = 'Email is required';
    if (!values.ownerPhone.trim()) {
      nextErrors.ownerPhone = 'Contact number is required';
    } else if (!/^\d{10}$/.test(values.ownerPhone.trim())) {
      nextErrors.ownerPhone = 'Contact number must be exactly 10 digits';
    }
    if (!values.ownerGender) nextErrors.ownerGender = 'Gender is required';
    if (values.storeMode === 'new') {
      if (!values.storeName.trim()) nextErrors.storeName = 'Store name is required';
      if (!values.storeLocation.trim()) nextErrors.storeLocation = 'Store location is required';
    }
    if (values.storeMode === 'existing' && values.existingStoreId == null) {
      nextErrors.existingStoreId = 'Select a store to assign';
    }
    return nextErrors;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const payload: AddOwnerValues = {
      ownerName: values.ownerName.trim(),
      ownerEmail: values.ownerEmail.trim(),
      ownerPhone: values.ownerPhone.trim(),
      ownerGender: values.ownerGender as OwnerGender,
    };
    if (values.storeMode === 'new') {
      payload.storeName = values.storeName.trim();
      payload.storeLocation = values.storeLocation.trim();
    } else if (values.storeMode === 'existing' && values.existingStoreId != null) {
      payload.existingStoreId = values.existingStoreId;
    }

    onSubmit(payload);
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
          <FormField label="Name" htmlFor="owner-name" required error={errors.ownerName}>
            <input
              id="owner-name"
              className="input"
              value={values.ownerName}
              onChange={(event) => updateField('ownerName', event.target.value)}
              autoFocus
            />
          </FormField>

          <FormField label="Email" htmlFor="owner-email" required error={errors.ownerEmail}>
            <input
              id="owner-email"
              type="email"
              className="input"
              value={values.ownerEmail}
              onChange={(event) => updateField('ownerEmail', event.target.value)}
            />
          </FormField>

          <FormField label="Contact" htmlFor="owner-phone" required error={errors.ownerPhone}>
            <input
              id="owner-phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              className="input"
              value={values.ownerPhone}
              onChange={(event) => updateField('ownerPhone', event.target.value)}
              placeholder="e.g. 5550000000"
            />
          </FormField>

          <FormField label="Gender" htmlFor="owner-gender" required error={errors.ownerGender}>
            <Select
              id="owner-gender"
              value={values.ownerGender}
              onChange={(value) => updateField('ownerGender', value as OwnerGender)}
              options={[{ value: '', label: 'Select gender' }, ...GENDER_OPTIONS]}
            />
          </FormField>

          <FormField label="Owner ID" htmlFor="owner-id">
            <input
              id="owner-id"
              className="input"
              value="Auto-assigned on save"
              disabled
              readOnly
            />
          </FormField>

          <div className="form-field--full">
            <p className="owner-form__hint">A temporary password will be emailed to this address.</p>
          </div>

          <div className="form-field--full">
            <FormField label="Store" htmlFor="owner-store-mode">
              <Select
                id="owner-store-mode"
                value={values.storeMode}
                onChange={(value) => updateField('storeMode', value as OwnerStoreMode)}
                options={STORE_MODE_OPTIONS}
              />
            </FormField>
          </div>

          {values.storeMode === 'new' && (
            <>
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

              <FormField label="Store ID" htmlFor="owner-store-id">
                <input
                  id="owner-store-id"
                  className="input"
                  value={nextStoreCode != null ? `#${nextStoreCode}` : 'Assigned automatically'}
                  disabled
                  readOnly
                />
              </FormField>
            </>
          )}

          {values.storeMode === 'existing' && (
            <div className="form-field--full">
              <FormField label="Existing Store" htmlFor="owner-existing-store" error={errors.existingStoreId}>
                {reassignableLoading ? (
                  <p className="owner-form__hint">Loading stores...</p>
                ) : reassignableError ? (
                  <p className="owner-form__hint owner-form__hint--error">{reassignableError}</p>
                ) : reassignableStores.length === 0 ? (
                  <p className="owner-form__hint">No stores with a deactivated owner are available to reassign.</p>
                ) : (
                  <Select
                    id="owner-existing-store"
                    value={values.existingStoreId != null ? String(values.existingStoreId) : ''}
                    onChange={(value) => updateField('existingStoreId', Number(value))}
                    options={reassignableStores.map((store) => ({
                      value: String(store.storeId),
                      label: store.currentOwnerName
                        ? `#${store.storeCode} · ${store.storeName} — was ${store.currentOwnerName}`
                        : `#${store.storeCode} · ${store.storeName} — unassigned`,
                    }))}
                  />
                )}
              </FormField>
            </div>
          )}

          {values.storeMode === 'none' && (
            <div className="form-field--full">
              <p className="owner-form__hint">This owner won't have a store yet. You can add one later from their card.</p>
            </div>
          )}
        </div>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default OwnerFormModal;
