import { useEffect, useState, type FormEvent } from 'react';
import type { EmployeeCreateValues, EmployeeUpdateValues, StoreOption } from '../types/employee';
import { EMPLOYEE_TYPE_OPTIONS, GENDER_OPTIONS, SHIFT_OPTIONS } from '../utils/employeeOptions';
import { validateEmployeeForm } from '../utils/employeeUtils';
import { COUNTRY_CODE_OPTIONS, parsePhoneForForm } from '../utils/countryCodes';
import Modal from './Modal';
import FormField from './FormField';
import MultiSelect from './MultiSelect';
import Select from './Select';
import './EmployeeFormModal.css';

type FormValues = EmployeeUpdateValues & { countryCode: string };

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

function emptyValues(): FormValues {
  return {
    name: '',
    storeIds: [],
    shift: SHIFT_OPTIONS[0].name,
    phone: '',
    countryCode: COUNTRY_CODE_OPTIONS[0].code,
    employeeType: EMPLOYEE_TYPE_OPTIONS[0],
    email: '',
    gender: GENDER_OPTIONS[0],
  };
}

function valuesFromInitial(initialValues: EmployeeUpdateValues): FormValues {
  const { countryCode, phone } = parsePhoneForForm(initialValues.phone);
  return { ...initialValues, phone, countryCode };
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
    initialValues ? valuesFromInitial(initialValues) : emptyValues(),
  );
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeCreateValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ? valuesFromInitial(initialValues) : emptyValues());
      setErrors({});
    }
  }, [isOpen, initialValues]);

  function updateField<K extends keyof FormValues>(field: K, value: FormValues[K]) {
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
          <div className="form-field--full">
            <FormField label="Name" htmlFor="employee-name" required error={errors.name}>
              <input
                id="employee-name"
                className="input"
                value={values.name}
                onChange={(event) => updateField('name', event.target.value)}
              />
            </FormField>
          </div>

          <div className="form-field--full">
            <FormField label="Assigned Stores" htmlFor="employee-stores" error={errors.storeIds}>
              <MultiSelect
                id="employee-stores"
                options={storeOptions.map((store) => ({ id: store.id, label: store.name }))}
                value={values.storeIds}
                onChange={(ids) => updateField('storeIds', ids)}
                placeholder="Select stores..."
                searchPlaceholder="Search stores..."
              />
            </FormField>
          </div>

          <FormField label="Shift" htmlFor="employee-shift" required error={errors.shift}>
            <Select
              id="employee-shift"
              value={values.shift}
              onChange={(value) => updateField('shift', value as FormValues['shift'])}
              options={SHIFT_OPTIONS.map((shift) => ({
                value: shift.name,
                label: `${shift.name} (${shift.timeRange})`,
              }))}
            />
          </FormField>

          <FormField label="Type" htmlFor="employee-type" required error={errors.employeeType}>
            <Select
              id="employee-type"
              value={values.employeeType}
              onChange={(value) => updateField('employeeType', value as FormValues['employeeType'])}
              options={EMPLOYEE_TYPE_OPTIONS.map((type) => ({ value: type, label: type }))}
            />
          </FormField>

          <FormField label="Contact" htmlFor="employee-phone" required error={errors.phone}>
            <div className="employee-form__phone-row">
              <Select
                id="employee-country-code"
                className="employee-form__country-code"
                ariaLabel="Country code"
                value={values.countryCode}
                onChange={(value) => updateField('countryCode', value)}
                options={COUNTRY_CODE_OPTIONS.map((option) => ({ value: option.code, label: option.label }))}
              />
              <input
                id="employee-phone"
                className="input"
                inputMode="numeric"
                value={values.phone}
                onChange={(event) => updateField('phone', event.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit number"
              />
            </div>
          </FormField>

          <FormField label="Gender" htmlFor="employee-gender" error={errors.gender}>
            <Select
              id="employee-gender"
              value={values.gender}
              onChange={(value) => updateField('gender', value as FormValues['gender'])}
              options={GENDER_OPTIONS.map((gender) => ({ value: gender, label: gender }))}
            />
          </FormField>

          <div className="form-field--full">
            <FormField label="Email" htmlFor="employee-email" required error={errors.email}>
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
