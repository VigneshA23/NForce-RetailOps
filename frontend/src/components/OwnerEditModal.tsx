import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Building2, Mail, User, UserPen } from 'lucide-react';
import { shouldAutoFocus } from '../utils/autoFocus';
import type { UpdateOwnerValues } from '../types/owner';
import { getReassignableStores } from '../api/owners';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from '../utils/emailValidation';
import Modal from './Modal';
import FormField from './FormField';
import SearchableSelect, { type SearchableSelectOption } from './SearchableSelect';
import ButtonDots from './ButtonDots';
import './SupplierFormModal.css';

interface OwnerEditModalProps {
  isOpen: boolean;
  initialValues?: { ownerName: string; ownerEmail: string };
  // The stores this admin holds now (pre-selected). When given, the modal also
  // lists every vacant store, so stores can be added and removed here; the
  // submit carries the full selection.
  currentStores?: SearchableSelectOption[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: UpdateOwnerValues, storeIds: number[]) => void;
}

interface FormState {
  ownerName: string;
  ownerEmail: string;
}

const EMPTY: FormState = { ownerName: '', ownerEmail: '' };

function OwnerEditModal({ isOpen, initialValues, currentStores, errorMessage, isSubmitting = false, onClose, onSubmit }: OwnerEditModalProps) {
  const [values, setValues] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>([]);
  const [vacantStores, setVacantStores] = useState<SearchableSelectOption[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [storesReloadToken, setStoresReloadToken] = useState(0);

  // Load the starting values only when the modal opens, not whenever the
  // parent re-renders (a background poll gives a new initialValues object and
  // used to wipe unsaved edits). Same fix as SupplierFormModal.
  const wasOpen = useRef(false);
  useEffect(() => {
    const opening = isOpen && !wasOpen.current;
    wasOpen.current = isOpen;
    if (!opening) return;
    setValues(initialValues ?? EMPTY);
    setErrors({});
    setSelectedStoreIds((currentStores ?? []).map((store) => store.id));
    // currentStores is derived per open from the same edit target as
    // initialValues, so keying on initialValues is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialValues]);

  // Stores with no active admin: the ones that can be added to this admin.
  useEffect(() => {
    if (!isOpen || !currentStores) return;
    let active = true;
    setStoresLoading(true);
    setStoresError(null);
    getReassignableStores()
      .then((stores) => {
        if (!active) return;
        setVacantStores(stores.map((store) => ({
          id: store.storeId,
          label: store.storeName,
          sublabel: `#${store.storeCode}`,
        })));
      })
      .catch((cause: unknown) => {
        if (active) setStoresError(cause instanceof Error ? cause.message : 'Failed to load stores');
      })
      .finally(() => {
        if (active) setStoresLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, storesReloadToken]);

  const storeOptions: SearchableSelectOption[] = [
    ...(currentStores ?? []),
    ...vacantStores.filter((store) => !(currentStores ?? []).some((current) => current.id === store.id)),
  ];

  function updateField<K extends keyof FormState>(field: K, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function validate(): Partial<Record<keyof FormState, string>> {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!values.ownerName.trim()) next.ownerName = 'Name is required';
    if (!values.ownerEmail.trim()) next.ownerEmail = 'Email is required';
    else if (!isValidEmail(values.ownerEmail.trim())) next.ownerEmail = INVALID_EMAIL_MESSAGE;
    return next;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    onSubmit({ ownerName: values.ownerName.trim(), ownerEmail: values.ownerEmail.trim() }, selectedStoreIds);
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Owner"
      titleIcon={<UserPen size={18} />}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="owner-edit-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="owner-edit-form" onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <FormField label="Owner Name" htmlFor="edit-owner-name" error={errors.ownerName}>
            <div className="supplier-form__input-wrap">
              <User size={15} className="supplier-form__input-icon" aria-hidden="true" />
              <input
                id="edit-owner-name"
                className="input"
                value={values.ownerName}
                onChange={(event) => updateField('ownerName', event.target.value)}
                autoFocus={shouldAutoFocus()}
              />
            </div>
          </FormField>

          <FormField label="Owner Email" htmlFor="edit-owner-email" error={errors.ownerEmail}>
            <div className="supplier-form__input-wrap">
              <Mail size={15} className="supplier-form__input-icon" aria-hidden="true" />
              <input
                id="edit-owner-email"
                type="email"
                className="input"
                value={values.ownerEmail}
                onChange={(event) => updateField('ownerEmail', event.target.value)}
              />
            </div>
          </FormField>

          {currentStores && (
            <div className="form-field">
              <span className="form-field__label">Stores</span>
              <div className="supplier-form__input-wrap supplier-form__input-wrap--select">
                <Building2 size={15} className="supplier-form__input-icon" aria-hidden="true" />
                <SearchableSelect
                  id="edit-owner-stores"
                  placeholder="Select store(s)"
                  multiple
                  options={storeOptions}
                  selectedIds={selectedStoreIds}
                  onChange={setSelectedStoreIds}
                  isLoading={storesLoading}
                  error={storesError}
                  onRetry={() => setStoresReloadToken((token) => token + 1)}
                  emptyMessage="No stores available. Every store already has an admin."
                />
              </div>
            </div>
          )}

          {errorMessage && <p className="form-field__error">{errorMessage}</p>}
        </div>
      </form>
    </Modal>
  );
}

export default OwnerEditModal;
