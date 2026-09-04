import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Employees from './Employees';
import type { Employee } from '../types/employee';
import * as employeesApi from '../api/employees';

vi.mock('../api/employees');

function baseEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    empId: 'EMP-001',
    name: 'Asha Rao',
    email: 'asha@example.com',
    phone: '+91 9876543210',
    shift: 'Morning',
    employeeType: 'Full Time',
    gender: 'Female',
    active: true,
    stores: [{ id: 10, name: 'Owner Store' }],
    ...overrides,
  };
}

function renderEmployees(employees: Employee[], overrides: Partial<Parameters<typeof Employees>[0]> = {}) {
  const onEmployeesChanged = vi.fn();
  const setEmployees = vi.fn();
  render(
    <Employees
      employees={employees}
      setEmployees={setEmployees}
      employeesLoading={false}
      employeesError={null}
      onRetryEmployees={vi.fn()}
      onEmployeesChanged={onEmployeesChanged}
      {...overrides}
    />,
  );
  return { onEmployeesChanged, setEmployees };
}

// Proves the fix for the stale-list bug: every mutation that can leave the
// list out of sync with the backend (a store reassigned elsewhere, another
// admin's concurrent change) now triggers a re-fetch via onEmployeesChanged,
// instead of relying solely on the single row the mutation call itself
// returned.
describe('Employees list refresh after mutations', () => {
  beforeEach(() => {
    vi.mocked(employeesApi.getAssignableStores).mockResolvedValue([{ id: 10, name: 'Owner Store' }]);
  });

  it('re-fetches the employee list after a successful delete', async () => {
    const employee = baseEmployee();
    vi.mocked(employeesApi.deleteEmployee).mockResolvedValue(undefined);
    const { onEmployeesChanged } = renderEmployees([employee]);

    await userEvent.click(screen.getByRole('button', { name: /delete asha rao/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(employeesApi.deleteEmployee).toHaveBeenCalledWith(employee.id);
    expect(onEmployeesChanged).toHaveBeenCalled();
  });

  it('re-fetches the employee list after a successful status toggle', async () => {
    const employee = baseEmployee({ active: true });
    vi.mocked(employeesApi.setEmployeeStatus).mockResolvedValue({ ...employee, active: false });
    const { onEmployeesChanged } = renderEmployees([employee]);

    await userEvent.click(screen.getByLabelText('Deactivate Asha Rao'));
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));

    expect(employeesApi.setEmployeeStatus).toHaveBeenCalledWith(employee.id, false);
    expect(onEmployeesChanged).toHaveBeenCalled();
  });

  it('does not re-fetch when a mutation fails', async () => {
    const employee = baseEmployee();
    vi.mocked(employeesApi.deleteEmployee).mockRejectedValue(new Error('boom'));
    const { onEmployeesChanged } = renderEmployees([employee]);

    await userEvent.click(screen.getByRole('button', { name: /delete asha rao/i }));
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

    await screen.findByText(/boom/);
    expect(onEmployeesChanged).not.toHaveBeenCalled();
  });
});
