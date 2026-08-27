<<<<<<< Updated upstream
import type { EmployeeCreateValues, EmployeeUpdateValues, ShiftName } from '../types/employee';
=======
import type { EmployeeFormValues, ShiftName } from '../types/employee';
>>>>>>> Stashed changes
import { SHIFT_OPTIONS } from './employeeOptions';

export function getShiftTimeRange(shift: ShiftName): string {
  return SHIFT_OPTIONS.find((option) => option.name === shift)?.timeRange ?? '';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGIT_MIN = 7;
const PASSWORD_MIN_LENGTH = 8;
<<<<<<< Updated upstream

type EmployeeFormValues = EmployeeUpdateValues & { password?: string };

export function validateEmployeeForm(
  values: EmployeeFormValues,
  requirePassword: boolean,
): Partial<Record<keyof EmployeeCreateValues, string>> {
  const errors: Partial<Record<keyof EmployeeCreateValues, string>> = {};
=======

export function validateEmployeeForm(
  values: EmployeeFormValues,
  mode: 'create' | 'edit',
): Partial<Record<keyof EmployeeFormValues, string>> {
  const errors: Partial<Record<keyof EmployeeFormValues, string>> = {};
>>>>>>> Stashed changes

  if (!values.name.trim()) {
    errors.name = 'Name is required';
  }

  if (!values.storeId) {
    errors.storeId = 'Assigned store is required';
  }

  if (!values.shift) {
    errors.shift = 'Shift is required';
  }

  if (!values.phone.trim()) {
    errors.phone = 'Contact number is required';
  } else if (values.phone.replace(/\D/g, '').length < PHONE_DIGIT_MIN) {
    errors.phone = 'Enter a valid contact number';
  }

  if (!values.type) {
    errors.type = 'Employment type is required';
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  if (!values.gender) {
    errors.gender = 'Gender is required';
  }

<<<<<<< Updated upstream
  if (requirePassword) {
    if (!values.password || !values.password.trim()) {
      errors.password = 'Temporary password is required';
    } else if (values.password.trim().length < PASSWORD_MIN_LENGTH) {
      errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
    }
=======
  if (mode === 'create' && values.password.length < PASSWORD_MIN_LENGTH) {
    errors.password = `Password must be at least ${PASSWORD_MIN_LENGTH} characters`;
>>>>>>> Stashed changes
  }

  return errors;
}
