import { useEffect, useState, type FormEvent } from 'react';
import type { EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
import { validateEmployeeForm } from '../utils/employeeUtils';
import EmployeeFormFields, {
  emptyEmployeeFormValues,
  employeeFormValuesFromUpdate,
  type EmployeeFormValues,
} from './EmployeeFormFields';
import Modal from './Modal';
import ButtonDots from './ButtonDots';
import SearchableSelect from './SearchableSelect';
import './EmployeeFormModal.css';

interface EmployeeFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: EmployeeUpdateValues;
  // SA-only: when provided, a store picker is shown and storeIds is included in onSubmit values.
  availableStores?: StoreOption[];
  initialStoreIds?: number[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: EmployeeCreateValues | EmployeeUpdateValues) => void;
}

function EmployeeFormModal({
  isOpen,
  mode,
  initialValues,
  availableStores,
  initialStoreIds,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: EmployeeFormModalProps) {
  const [values, setValues] = useState<EmployeeFormValues>(
    initialValues ? employeeFormValuesFromUpdate(initialValues) : emptyEmployeeFormValues(),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeCreateValues, string>>>({});
  const [selectedStoreIds, setSelectedStoreIds] = useState<number[]>(initialStoreIds ?? []);

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ? employeeFormValuesFromUpdate(initialValues) : emptyEmployeeFormValues());
      setSelectedStoreIds(initialStoreIds ?? []);
      setErrors({});
    }
  }, [isOpen, initialValues, initialStoreIds]);

  function updateField<K extends keyof EmployeeFormValues>(field: K, value: EmployeeFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validateEmployeeForm(values);
    if (availableStores && availableStores.length > 0 && selectedStoreIds.length === 0) {
      validationErrors.storeIds = 'At least one store must be assigned';
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const { countryCode, phone, ...rest } = values;
    const combinedPhone = `${countryCode} ${phone}`.trim();
    const storePayload = availableStores ? { storeIds: selectedStoreIds } : {};
    if (mode === 'create') {
      onSubmit({ ...rest, phone: combinedPhone, ...storePayload } satisfies EmployeeCreateValues);
    } else {
      onSubmit({ ...rest, phone: combinedPhone, ...storePayload } satisfies EmployeeUpdateValues);
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={mode === 'create' ? 'Add Employee' : 'Edit Employee'}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="employee-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : mode === 'create' ? 'Add Employee' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit} noValidate>
        <div className="employee-form__grid">
          <EmployeeFormFields values={values} errors={errors} onChange={updateField} />

          {mode === 'create' && (
            <div className="form-field--full">
              <p className="employee-form__hint">A temporary password will be emailed to this address.</p>
            </div>
          )}

          {availableStores && availableStores.length > 0 && (
            <div className="form-field--full employee-form__store-section">
              <span className="form-field__label">Assign to Stores <span className="form-field__required">*</span></span>
              <SearchableSelect
                id="employee-stores"
                placeholder="Select store(s)"
                multiple
                options={availableStores.map((store) => ({ id: store.id, label: store.name }))}
                selectedIds={selectedStoreIds}
                // Employees don't have a persisted "applies to all stores" concept
                // (unlike Tasks/Categories) -- this is a pure select-all/clear-all
                // convenience, not a separate stored flag.
                allOption={{
                  label: 'All Stores',
                  selected: availableStores.every((store) => selectedStoreIds.includes(store.id)),
                  onToggle: () => setSelectedStoreIds((current) =>
                    availableStores.every((store) => current.includes(store.id))
                      ? []
                      : availableStores.map((store) => store.id),
                  ),
                }}
                onChange={setSelectedStoreIds}
              />
              {errors.storeIds && <p className="form-field__error">{errors.storeIds}</p>}
            </div>
          )}
        </div>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default EmployeeFormModal;
