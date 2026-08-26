import type { Employee, EmployeeFormValues, ShiftName } from '../types/employee';
import { SHIFT_OPTIONS } from './employeeOptions';

export function getNextEmpId(employees: Employee[]): string {
  const maxNumber = employees.reduce((max, employee) => {
    const match = /^EMP-(\d+)$/.exec(employee.empId);
    if (!match) return max;
    return Math.max(max, Number(match[1]));
  }, 0);

  return `EMP-${String(maxNumber + 1).padStart(3, '0')}`;
}

export function getShiftTimeRange(shift: ShiftName): string {
  return SHIFT_OPTIONS.find((option) => option.name === shift)?.timeRange ?? '';
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_DIGIT_MIN = 7;

export function validateEmployeeForm(
  values: EmployeeFormValues,
): Partial<Record<keyof EmployeeFormValues, string>> {
  const errors: Partial<Record<keyof EmployeeFormValues, string>> = {};

  if (!values.name.trim()) {
    errors.name = 'Name is required';
  }

  if (!values.store) {
    errors.store = 'Assigned store is required';
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

  return errors;
}
