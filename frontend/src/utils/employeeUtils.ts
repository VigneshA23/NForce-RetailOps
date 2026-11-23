import type { Employee, EmployeeCreateValues, EmployeeUpdateValues } from '../types/employee';
import { COUNTRY_CODE_OPTIONS, validatePhoneNumber } from './countryCodes';
import { INVALID_EMAIL_MESSAGE, isValidEmail } from './emailValidation';

export function toEmployeeUpdateValues(employee: Employee): EmployeeUpdateValues {
  return {
    name: employee.name,
    email: employee.email,
    phone: employee.phone,
    employeeType: employee.employeeType,
    gender: employee.gender,
  };
}

const NAME_PATTERN = /^[A-Za-z]+(?: [A-Za-z]+)*$/;
export function validateEmployeeForm(
  values: EmployeeUpdateValues & { countryCode?: string },
): Partial<Record<keyof EmployeeCreateValues, string>> {
  const errors: Partial<Record<keyof EmployeeCreateValues, string>> = {};

  if (!values.name.trim()) {
    errors.name = 'Name is required';
  } else if (!NAME_PATTERN.test(values.name.trim())) {
    errors.name = 'Name can only contain letters, with a single space between words';
  }

  if (!values.phone.trim()) {
    errors.phone = 'Contact number is required';
  } else {
    const phoneError = validatePhoneNumber(values.countryCode ?? COUNTRY_CODE_OPTIONS[0].code, values.phone.trim());
    if (phoneError) errors.phone = phoneError;
  }

  if (!values.employeeType) {
    errors.employeeType = 'Employment type is required';
  }

  if (!values.email.trim()) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(values.email.trim())) {
    errors.email = INVALID_EMAIL_MESSAGE;
  }

  if (!values.gender) {
    errors.gender = 'Gender is required';
  }

  return errors;
}
