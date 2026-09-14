import { describe, expect, it, vi, afterEach } from 'vitest';
import { updateEmployee } from './employees';
import type { EmployeeUpdateValues } from '../types/employee';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('updateEmployee error messages', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces a field-validation error (no top-level "message") instead of the generic fallback', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(400, { employeeType: 'Employment type is required' }),
    );

    await expect(
      updateEmployee(1, {
        name: 'Ananya Reddy',
        email: 'ananya.reddy@kedsicecream.com',
        phone: '+1 2145550101',
        shift: 'Morning',
        // Cast: simulates the legacy/mismatched data that reaches the backend
        // as blank -- EmployeeType itself never allows an empty string.
        employeeType: '' as EmployeeUpdateValues['employeeType'],
        gender: 'Female',
      }),
    ).rejects.toThrow('Employment type is required');
  });

  it('still surfaces a domain error that already has a top-level "message"', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(409, { message: 'A user with this email already exists' }),
    );

    await expect(
      updateEmployee(1, {
        name: 'Ananya Reddy',
        email: 'taken@kedsicecream.com',
        phone: '+1 2145550101',
        shift: 'Morning',
        employeeType: 'Full Time',
        gender: 'Female',
      }),
    ).rejects.toThrow('A user with this email already exists');
  });

  it('falls back to the generic message when the error body has no usable text', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(500, {}));

    await expect(
      updateEmployee(1, {
        name: 'Ananya Reddy',
        email: 'ananya.reddy@kedsicecream.com',
        phone: '+1 2145550101',
        shift: 'Morning',
        employeeType: 'Full Time',
        gender: 'Female',
      }),
    ).rejects.toThrow('Failed to update employee');
  });

  it('does not leak Spring Boot\'s default 500 error body (timestamp/error/path) as the message', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(500, {
        timestamp: '2026-09-11T06:10:00.000+00:00',
        status: 500,
        error: 'Internal Server Error',
        path: '/api/employees/5',
      }),
    );

    await expect(
      updateEmployee(1, {
        name: 'Ananya Reddy',
        email: 'ananya.reddy@kedsicecream.com',
        phone: '+1 2145550101',
        shift: 'Morning',
        employeeType: 'Full Time',
        gender: 'Female',
      }),
    ).rejects.toThrow('Failed to update employee');
  });
});
