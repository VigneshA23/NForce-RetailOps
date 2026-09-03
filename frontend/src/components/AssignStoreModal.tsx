import { useEffect, useState, type FormEvent } from 'react';
import { getNextStoreCode, getReassignableStores } from '../api/owners';
import type { AssignStoreMode, AssignStoreValues, ReassignableStore } from '../types/owner';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import './AssignStoreModal.css';

interface AssignStoreModalProps {
  isOpen: boolean;
  ownerName?: string;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: AssignStoreValues) => void;
}

interface FormState {
  storeMode: AssignStoreMode;
  storeName: string;
  storeLocation: string;
  existingStoreId: number | null;
}

const EMPTY_VALUES: FormState = {
  storeMode: 'new',
  storeName: '',
  storeLocation: '',
  existingStoreId: null,
};

const STORE_MODE_OPTIONS = [
  { value: 'new', label: 'Create a new store' },
  { value: 'existing', label: 'Assign an unassigned store' },
];

function AssignStoreModal({
  isOpen,
  ownerName,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: AssignStoreModalProps) {
  const [values, setValues] = useState<FormState>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [nextStoreCode, setNextStoreCode] = useState<number | null>(null);
  const [unassignedStores, setUnassignedStores] = useState<ReassignableStore[]>([]);
  const [unassignedLoading, setUnassignedLoading] = useState(false);
  const [unassignedError, setUnassignedError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setValues(EMPTY_VALUES);
    setErrors({});

    setNextStoreCode(null);
    getNextStoreCode()
      .then(setNextStoreCode)
      .catch(() => setNextStoreCode(null));

    setUnassignedStores([]);
    setUnassignedError(null);
    setUnassignedLoading(true);
    getReassignableStores()
      .then(setUnassignedStores)
      .catch((error) => setUnassignedError(error instanceof Error ? error.message : 'Failed to load stores'))
      .finally(() => setUnassignedLoading(false));
  }, [isOpen]);

  function updateField<K extends keyof FormState>(field: K, value: FormState[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof FormState, string>> = {};
    if (values.storeMode === 'new') {
      if (!values.storeName.trim()) nextErrors.storeName = 'Store name is required';
      if (!values.storeLocation.trim()) nextErrors.storeLocation = 'Store location is required';
    } else if (values.existingStoreId == null) {
      nextErrors.existingStoreId = 'Select a store to assign';
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (values.storeMode === 'new') {
      onSubmit({
        storeName: values.storeName.trim(),
        storeLocation: values.storeLocation.trim(),
      });
    } else if (values.existingStoreId != null) {
      onSubmit({ existingStoreId: values.existingStoreId });
    }
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
        <FormField label="Store" htmlFor="assign-store-mode">
          <Select
            id="assign-store-mode"
            value={values.storeMode}
            onChange={(value) => updateField('storeMode', value as AssignStoreMode)}
            options={STORE_MODE_OPTIONS}
          />
        </FormField>

        {values.storeMode === 'new' ? (
          <>
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

            <p className="assign-store-modal__hint">
              {nextStoreCode != null ? (
                <>
                  This store will be assigned Store ID <strong>#{nextStoreCode}</strong>.
                </>
              ) : (
                'A unique Store ID will be assigned automatically.'
              )}
            </p>
          </>
        ) : (
          <FormField label="Unassigned Store" htmlFor="assign-store-existing" error={errors.existingStoreId}>
            {unassignedLoading ? (
              <p className="assign-store-modal__hint">Loading stores...</p>
            ) : unassignedError ? (
              <p className="assign-store-modal__hint assign-store-modal__hint--error">{unassignedError}</p>
            ) : unassignedStores.length === 0 ? (
              <p className="assign-store-modal__hint">No unassigned stores are available right now.</p>
            ) : (
              <Select
                id="assign-store-existing"
                value={values.existingStoreId != null ? String(values.existingStoreId) : ''}
                onChange={(value) => updateField('existingStoreId', Number(value))}
                options={unassignedStores.map((store) => ({
                  value: String(store.storeId),
                  label: `#${store.storeCode} · ${store.storeName} — was ${store.currentOwnerName}`,
                }))}
              />
            )}
          </FormField>
        )}

        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default AssignStoreModal;
