import { useEffect, useState, type FormEvent } from 'react';
import type { EmployeeFormValues } from '../types/employee';
import {
  EMPLOYEE_TYPE_OPTIONS,
  GENDER_OPTIONS,
  SHIFT_OPTIONS,
  STORE_OPTIONS,
} from '../utils/employeeOptions';
import { validateEmployeeForm } from '../utils/employeeUtils';
import Modal from './Modal';
import FormField from './FormField';
import './EmployeeFormModal.css';

interface EmployeeFormModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  initialValues?: EmployeeFormValues;
  onClose: () => void;
  onSubmit: (values: EmployeeFormValues) => void;
}

const EMPTY_VALUES: EmployeeFormValues = {
  name: '',
  store: STORE_OPTIONS[0],
  shift: SHIFT_OPTIONS[0].name,
  phone: '',
  type: EMPLOYEE_TYPE_OPTIONS[0],
  email: '',
  gender: GENDER_OPTIONS[0],
};

function EmployeeFormModal({ isOpen, mode, initialValues, onClose, onSubmit }: EmployeeFormModalProps) {
  const [values, setValues] = useState<EmployeeFormValues>(initialValues ?? EMPTY_VALUES);
  const [errors, setErrors] = useState<Partial<Record<keyof EmployeeFormValues, string>>>({});

  useEffect(() => {
    if (isOpen) {
      setValues(initialValues ?? EMPTY_VALUES);
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
    onSubmit(values);
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
          <button type="submit" form="employee-form" className="btn btn--primary">
            {mode === 'create' ? 'Add Employee' : 'Save Changes'}
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

          <FormField label="Assigned Store" htmlFor="employee-store" error={errors.store}>
            <select
              id="employee-store"
              className="select"
              value={values.store}
              onChange={(event) => updateField('store', event.target.value as EmployeeFormValues['store'])}
            >
              {STORE_OPTIONS.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Shift" htmlFor="employee-shift" error={errors.shift}>
            <select
              id="employee-shift"
              className="select"
              value={values.shift}
              onChange={(event) => updateField('shift', event.target.value as EmployeeFormValues['shift'])}
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
              onChange={(event) => updateField('type', event.target.value as EmployeeFormValues['type'])}
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
              onChange={(event) => updateField('gender', event.target.value as EmployeeFormValues['gender'])}
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
        </div>
      </form>
    </Modal>
  );
}

export default EmployeeFormModal;
