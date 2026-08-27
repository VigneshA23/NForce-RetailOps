import { useEffect, useState, type FormEvent } from 'react';
import type { EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
import { EMPLOYEE_TYPE_OPTIONS, GENDER_OPTIONS, SHIFT_OPTIONS } from '../utils/employeeOptions';
import { validateEmployeeForm } from '../utils/employeeUtils';
import Modal from './Modal';
import FormField from './FormField';
import './EmployeeFormModal.css';

type FormValues = EmployeeUpdateValues & { password: string };

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

function emptyValues(storeOptions: StoreOption[]): FormValues {
  return {
    name: '',
    storeId: storeOptions[0]?.id ?? 0,
    shift: SHIFT_OPTIONS[0].name,
    phone: '',
    type: EMPLOYEE_TYPE_OPTIONS[0],
    email: '',
    gender: GENDER_OPTIONS[0],
    password: '',
  };
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
  const [values, setValues] = useState<FormValues>(
    initialValues ? { ...initialValues, password: '' } : emptyValues(storeOptions),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeCreateValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ? { ...initialValues, password: '' } : emptyValues(storeOptions));
      setErrors({});
    }
  }, [isOpen, initialValues, storeOptions]);

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const requirePassword = mode === 'create';
    const validationErrors = validateEmployeeForm(values, requirePassword);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    const { password, ...rest } = values;
    if (mode === 'create') {
      onSubmit({ ...rest, password: password.trim() } satisfies EmployeeCreateValues);
    } else {
      onSubmit(rest satisfies EmployeeUpdateValues);
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
          <FormField label="Name" htmlFor="employee-name" error={errors.name}>
            <input
              id="employee-name"
              className="input"
              value={values.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </FormField>

          <FormField label="Assigned Store" htmlFor="employee-store" error={errors.storeId}>
            <select
              id="employee-store"
              className="select"
              value={values.storeId}
              onChange={(event) => updateField('storeId', Number(event.target.value))}
            >
              {storeOptions.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Shift" htmlFor="employee-shift" error={errors.shift}>
            <select
              id="employee-shift"
              className="select"
              value={values.shift}
              onChange={(event) => updateField('shift', event.target.value as FormValues['shift'])}
            >
              {SHIFT_OPTIONS.map((shift) => (
                <option key={shift.name} value={shift.name}>
                  {shift.name} ({shift.timeRange})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Type" htmlFor="employee-type" error={errors.type}>
            <select
              id="employee-type"
              className="select"
              value={values.type}
              onChange={(event) => updateField('type', event.target.value as FormValues['type'])}
            >
              {EMPLOYEE_TYPE_OPTIONS.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Contact" htmlFor="employee-phone" error={errors.phone}>
            <input
              id="employee-phone"
              className="input"
              value={values.phone}
              onChange={(event) => updateField('phone', event.target.value)}
              placeholder="(555) 201-0000"
            />
          </FormField>

          <FormField label="Gender" htmlFor="employee-gender" error={errors.gender}>
            <select
              id="employee-gender"
              className="select"
              value={values.gender}
              onChange={(event) => updateField('gender', event.target.value as FormValues['gender'])}
            >
              {GENDER_OPTIONS.map((gender) => (
                <option key={gender} value={gender}>
                  {gender}
                </option>
              ))}
            </select>
          </FormField>

          <div className="form-field--full">
            <FormField label="Email" htmlFor="employee-email" error={errors.email}>
              <input
                id="employee-email"
                type="email"
                className="input"
                value={values.email}
                onChange={(event) => updateField('email', event.target.value)}
              />
            </FormField>
          </div>

          {mode === 'create' && (
            <div className="form-field--full">
              <FormField label="Temporary Password" htmlFor="employee-password" error={errors.password}>
                <input
                  id="employee-password"
                  type="password"
                  className="input"
                  value={values.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                />
              </FormField>
            </div>
          )}
        </div>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>
    </Modal>
  );
}

export default EmployeeFormModal;
