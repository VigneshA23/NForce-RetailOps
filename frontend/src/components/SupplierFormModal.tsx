import { useEffect, useState, type FormEvent } from 'react';
import { Building2, MapPin, Truck } from 'lucide-react';
import type { SupplierFormValues, SupplierStoreOption } from '../types/supplier';
import { COUNTRY_CODE_OPTIONS, parsePhoneForForm } from '../utils/countryCodes';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import SearchableSelect from './SearchableSelect';
import ButtonDots from './ButtonDots';
import './SupplierFormModal.css';

interface SupplierFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: SupplierFormValues;
  // Super Admin's own Add/Edit Supplier form only (RTS-304 follow-up).
  // Omitted entirely for Owner/Admin's rename-only usage of this same modal
  // (StoreInventory.tsx), which keeps today's name-only behavior unchanged.
  extended?: boolean;
  availableStores?: SupplierStoreOption[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: SupplierFormValues) => void;
}

const EMPTY_VALUES: SupplierFormValues = {
  name: '',
  contact: '',
  location: '',
  appliesToAllStores: false,
  storeIds: [],
};

function SupplierFormModal({
  isOpen,
  mode,
  initialValues,
  extended = false,
  availableStores = [],
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: SupplierFormModalProps) {
  const [values, setValues] = useState<SupplierFormValues>({ ...EMPTY_VALUES, ...initialValues });
  const [countryCode, setCountryCode] = useState(COUNTRY_CODE_OPTIONS[0].code);
  const [phone, setPhone] = useState('');
  const [validationError, setValidationError] = useState<string | undefined>();

  useEffect(() => {
    if (isOpen) {
      setValues({ ...EMPTY_VALUES, ...initialValues });
      const parsed = parsePhoneForForm(initialValues?.contact ?? '');
      setCountryCode(parsed.countryCode);
      setPhone(parsed.phone);
      setValidationError(undefined);
    }
  }, [isOpen, initialValues]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!values.name.trim()) {
      setValidationError('Name is required');
      return;
    }
    if (extended && !values.appliesToAllStores && (values.storeIds ?? []).length === 0) {
      setValidationError('Select at least one store, or choose All Stores');
      return;
    }
    if (!extended) {
      onSubmit({ name: values.name.trim() });
      return;
    }
    onSubmit({
      ...values,
      name: values.name.trim(),
      contact: phone.trim() ? `${countryCode} ${phone.trim()}` : '',
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Supplier' : 'Edit Supplier'}
      subtitle={
        extended
          ? mode === 'create'
            ? 'Add a supplier to the platform directory and assign it to the stores that use it.'
            : 'Update the name, contact, location and stores for this supplier.'
          : undefined
      }
      className={extended ? 'supplier-form-modal' : undefined}
      footer={
        <>
          <button type="button" className={`btn btn--secondary${extended ? ' supplier-form__cancel' : ''}`} onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="supplier-form"
            className={`btn btn--primary${extended ? ' supplier-form__submit' : ''}${isSubmitting ? ' btn--loading' : ''}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? <ButtonDots label="Saving" /> : mode === 'create' ? 'Add Supplier' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="supplier-form" className={extended ? 'supplier-form' : undefined} onSubmit={handleSubmit} noValidate>
        <FormField label="Supplier Name" htmlFor="supplier-name" error={validationError}>
          <div className={extended ? 'supplier-form__input-wrap' : undefined}>
            {extended && <Truck size={15} className="supplier-form__input-icon" aria-hidden="true" />}
            <input
              id="supplier-name"
              className="input"
              value={values.name}
              onChange={(event) => setValues((current) => ({ ...current, name: event.target.value }))}
              placeholder="e.g. Walmart, Sam's Club"
              autoFocus
            />
          </div>
        </FormField>

        {extended && (
          <>
            <FormField label="Contact" htmlFor="supplier-phone">
              <div className="supplier-form__phone-row">
                <Select
                  id="supplier-country-code"
                  className="supplier-form__country-code"
                  ariaLabel="Country code"
                  value={countryCode}
                  onChange={setCountryCode}
                  options={COUNTRY_CODE_OPTIONS.map((option) => ({ value: option.code, label: option.label }))}
                />
                <input
                  id="supplier-phone"
                  className="input"
                  inputMode="numeric"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="10-digit number"
                />
              </div>
            </FormField>

            <FormField label="Location" htmlFor="supplier-location">
              <div className="supplier-form__input-wrap">
                <MapPin size={15} className="supplier-form__input-icon" aria-hidden="true" />
                <input
                  id="supplier-location"
                  className="input"
                  value={values.location ?? ''}
                  onChange={(event) => setValues((current) => ({ ...current, location: event.target.value }))}
                  placeholder="e.g. Downtown, Austin TX"
                />
              </div>
            </FormField>

            <FormField label="Select Store" htmlFor="supplier-stores">
              <div className="supplier-form__input-wrap supplier-form__input-wrap--select">
                <Building2 size={15} className="supplier-form__input-icon" aria-hidden="true" />
                <SearchableSelect
                  id="supplier-stores"
                  placeholder="Select store(s)"
                  multiple
                  options={availableStores.map((store) => ({ id: store.id, label: store.name }))}
                  selectedIds={values.storeIds ?? []}
                  allOption={{
                    label: 'All Stores',
                    selected: values.appliesToAllStores ?? false,
                    onToggle: () => setValues((current) => ({ ...current, appliesToAllStores: !current.appliesToAllStores, storeIds: [] })),
                  }}
                  onChange={(ids) => {
                    const everyStoreSelected = availableStores.length > 0 && availableStores.every((store) => ids.includes(store.id));
                    setValues((current) => ({
                      ...current,
                      ...(everyStoreSelected
                        ? { appliesToAllStores: true, storeIds: [] }
                        : { appliesToAllStores: false, storeIds: ids }),
                    }));
                  }}
                />
              </div>
            </FormField>
          </>
        )}

        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default SupplierFormModal;
