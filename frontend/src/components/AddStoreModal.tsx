import { useEffect, useState, type FormEvent } from 'react';
import { MapPin, Store as StoreIcon } from 'lucide-react';
import { shouldAutoFocus } from '../utils/autoFocus';
import { getNextStoreCode } from '../api/owners';
import type { CreateStoreValues } from '../types/superAdminStore';
import Modal from './Modal';
import FormField from './FormField';
import ButtonDots from './ButtonDots';
import StoreCashTargetField, { validateCashTarget } from './StoreCashTargetField';
import { parseAmount } from '../utils/amountInput';
import './AssignStoreModal.css';
import './SupplierFormModal.css';

interface AddStoreModalProps {
  isOpen: boolean;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CreateStoreValues) => void;
}

// The form's own state: the target is kept as typed text until submit.
interface FormValues {
  name: string;
  location: string;
  cashTarget: string;
}

const EMPTY_VALUES: FormValues = { name: '', location: '', cashTarget: '' };

// Creates a store with no owner -- it shows up as an "existing store" pick
// when a new Owner is created later.
function AddStoreModal({ isOpen, errorMessage, isSubmitting = false, onClose, onSubmit }: AddStoreModalProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});
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

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const nextErrors: Partial<Record<keyof FormValues, string>> = {};
    if (!values.name.trim()) nextErrors.name = 'Store name is required';
    if (!values.location.trim()) nextErrors.location = 'Store location is required';
    const cashTargetError = validateCashTarget(values.cashTarget);
    if (cashTargetError) nextErrors.cashTarget = cashTargetError;
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit({
      name: values.name.trim(),
      location: values.location.trim(),
      cashTarget: parseAmount(values.cashTarget),
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Store"
      titleIcon={<StoreIcon size={18} />}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="add-store-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Add Store'}
          </button>
        </>
      }
    >
      <form id="add-store-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Store Name" htmlFor="add-store-name" error={errors.name}>
          <div className="supplier-form__input-wrap">
            <StoreIcon size={15} className="supplier-form__input-icon" aria-hidden="true" />
            <input
              id="add-store-name"
              className="input"
              value={values.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="e.g. Downtown Ice Cream Co."
              autoFocus={shouldAutoFocus()}
            />
          </div>
        </FormField>

        <FormField label="Store Location" htmlFor="add-store-location" error={errors.location}>
          <div className="supplier-form__input-wrap">
            <MapPin size={15} className="supplier-form__input-icon" aria-hidden="true" />
            <input
              id="add-store-location"
              className="input"
              value={values.location}
              onChange={(event) => updateField('location', event.target.value)}
              placeholder="e.g. Downtown, Austin TX"
            />
          </div>
        </FormField>

        <StoreCashTargetField
          id="add-store-cash-target"
          value={values.cashTarget}
          error={errors.cashTarget}
          onChange={(value) => updateField('cashTarget', value)}
        />

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
