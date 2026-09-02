import type { EmployeeCreateValues, EmployeeUpdateValues, ShiftName } from '../types/employee';
import { SHIFT_OPTIONS } from './employeeOptions';

export function getShiftTimeRange(shift: ShiftName): string {
  return SHIFT_OPTIONS.find((option) => option.name === shift)?.timeRange ?? '';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
const PHONE_PATTERN = /^\d{10}$/;
export function validateEmployeeForm(
  values: EmployeeUpdateValues,
): Partial<Record<keyof EmployeeCreateValues, string>> {
  const errors: Partial<Record<keyof EmployeeCreateValues, string>> = {};

  if (!values.name.trim()) {
    errors.name = 'Name is required';
  } else if (!NAME_PATTERN.test(values.name.trim())) {
    errors.name = 'Name can only contain letters, with a single space between words';
  }

  if (!values.shift) {
    errors.shift = 'Shift is required';
  }

  if (!values.phone.trim()) {
    errors.phone = 'Contact number is required';
  } else if (!PHONE_PATTERN.test(values.phone.trim())) {
    errors.phone = 'Contact number must be exactly 10 digits';
  }

  if (!values.employeeType) {
    errors.employeeType = 'Employment type is required';
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required';
  } else if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = 'Enter a valid email address';
  }

  if (!values.gender) {
    errors.gender = 'Gender is required';
  }

  return errors;
}
