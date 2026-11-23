import { describe, expect, it } from 'vitest';
import type { EmployeeUpdateValues } from '../types/employee';
import { validateEmployeeForm } from './employeeUtils';

const VALID: EmployeeUpdateValues = {
  name: 'Jane Doe',
  email: 'jane@nforceone.com',
  phone: '5550100099',
  employeeType: 'Full Time',
  gender: 'Female',
};

// RTS-582: Employee create/edit uses the same email rule and message as Login.
describe('validateEmployeeForm email', () => {
  it('accepts a valid email, ignoring surrounding spaces', () => {
    expect(validateEmployeeForm({ ...VALID, email: '  jane@nforceone.com ' }).email).toBeUndefined();
  });

  it('requires an email', () => {
    expect(validateEmployeeForm({ ...VALID, email: '  ' }).email).toBe('Email is required');
  });

  it.each(['notanemail', 'jane@nforceone', 'jane@nforceone.c'])('rejects "%s" with the Login message', (email) => {
    expect(validateEmployeeForm({ ...VALID, email }).email).toBe('Please enter a valid email address');
  });
});
