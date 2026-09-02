import { useEffect, useState, type FormEvent } from 'react';
import type { EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
import { validateEmployeeForm } from '../utils/employeeUtils';
import EmployeeFormFields, {
  emptyEmployeeFormValues,
  employeeFormValuesFromUpdate,
  type EmployeeFormValues,
} from './EmployeeFormFields';
import Modal from './Modal';
import './EmployeeFormModal.css';

interface EmployeeFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: EmployeeUpdateValues;
  storeOptions: StoreOption[];
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: EmployeeCreateValues | EmployeeUpdateValues) => void;
}

function EmployeeFormModal({
  isOpen,
  mode,
  initialValues,
  storeOptions,
  errorMessage,
  isSubmitting = false,
  onClose,
  onSubmit,
}: EmployeeFormModalProps) {
  const [values, setValues] = useState<EmployeeFormValues>(
    initialValues ? employeeFormValuesFromUpdate(initialValues) : emptyEmployeeFormValues(),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeCreateValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ? employeeFormValuesFromUpdate(initialValues) : emptyEmployeeFormValues());
      setErrors({});
    }
  }, [isOpen, initialValues]);

  function updateField<K extends keyof EmployeeFormValues>(field: K, value: EmployeeFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const validationErrors = validateEmployeeForm(values);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const { countryCode, phone, ...rest } = values;
    const combinedPhone = `${countryCode} ${phone}`.trim();
    if (mode === 'create') {
      onSubmit({ ...rest, phone: combinedPhone } satisfies EmployeeCreateValues);
    } else {
      onSubmit({ ...rest, phone: combinedPhone } satisfies EmployeeUpdateValues);
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
          <button type="submit" form="employee-form" className="btn btn--primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Add Employee' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="employee-form" onSubmit={handleSubmit} noValidate>
        <div className="employee-form__grid">
          <EmployeeFormFields values={values} errors={errors} storeOptions={storeOptions} onChange={updateField} />

          {mode === 'create' && (
            <div className="form-field--full">
              <p className="employee-form__hint">A temporary password will be emailed to this address.</p>
            </div>
          )}
        </div>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default EmployeeFormModal;
