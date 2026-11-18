import { useEffect, useState, type FormEvent } from 'react';
import { MapPin, Store as StoreIcon } from 'lucide-react';
import { shouldAutoFocus } from '../utils/autoFocus';
import type { CreateStoreValues } from '../types/superAdminStore';
import Modal from './Modal';
import FormField from './FormField';
import ButtonDots from './ButtonDots';
import StoreCashTargetField, { validateCashTarget } from './StoreCashTargetField';
import { parseAmount } from '../utils/amountInput';
import { formatAmount } from '../utils/currency';
import './AssignStoreModal.css';
import './SupplierFormModal.css';

interface EditStoreModalProps {
  isOpen: boolean;
  // The store as saved; the target shows as its current amount.
  initialValues?: CreateStoreValues;
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

function EditStoreModal({ isOpen, initialValues, errorMessage, isSubmitting = false, onClose, onSubmit }: EditStoreModalProps) {
  const [values, setValues] = useState<FormValues>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({});

  useEffect(() => {
    if (!isOpen) return;
    setValues(initialValues
      ? { name: initialValues.name, location: initialValues.location, cashTarget: formatAmount(initialValues.cashTarget) }
      : EMPTY_VALUES);
    setErrors({});
  }, [isOpen, initialValues]);

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
      title="Edit Store"
      titleIcon={<StoreIcon size={18} />}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="edit-store-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="edit-store-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Store Name" htmlFor="edit-store-name" error={errors.name}>
          <div className="supplier-form__input-wrap">
            <StoreIcon size={15} className="supplier-form__input-icon" aria-hidden="true" />
            <input
              id="edit-store-name"
              className="input"
              value={values.name}
              onChange={(event) => updateField('name', event.target.value)}
              placeholder="e.g. Downtown Ice Cream Co."
              autoFocus={shouldAutoFocus()}
            />
          </div>
        </FormField>

        <FormField label="Store Location" htmlFor="edit-store-location" error={errors.location}>
          <div className="supplier-form__input-wrap">
            <MapPin size={15} className="supplier-form__input-icon" aria-hidden="true" />
            <input
              id="edit-store-location"
              className="input"
              value={values.location}
              onChange={(event) => updateField('location', event.target.value)}
              placeholder="e.g. Downtown, Austin TX"
            />
          </div>
        </FormField>

        <StoreCashTargetField
          id="edit-store-cash-target"
          value={values.cashTarget}
          error={errors.cashTarget}
          onChange={(value) => updateField('cashTarget', value)}
        />

        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default EditStoreModal;
