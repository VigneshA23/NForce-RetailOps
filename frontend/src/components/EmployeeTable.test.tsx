import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmployeeTable from './EmployeeTable';
import type { Employee } from '../types/employee';

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
    stores: [],
    ...overrides,
  };
}

function renderTable(employees: Employee[], props: Partial<Parameters<typeof EmployeeTable>[0]> = {}) {
  return render(
    <EmployeeTable
      employees={employees}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onToggleStatus={vi.fn()}
      {...props}
    />,
  );
}

describe('EmployeeTable', () => {
  it('renders exactly the rows it is given, without paginating internally', () => {
    const employees = Array.from({ length: 12 }, (_, index) =>
      baseEmployee({ id: index + 1, empId: `EMP-${index + 1}`, name: `Employee ${index + 1}` }),
    );

    renderTable(employees);

    // The page owns paging now - the table must not slice to a PAGE_SIZE of 10.
    expect(screen.getAllByRole('row')).toHaveLength(employees.length + 1); // + header row
    expect(screen.getByText('Employee 12')).toBeInTheDocument();
  });

  it('renders a plain header row with no sort buttons', () => {
    renderTable([baseEmployee()]);

    const headers = screen.getAllByRole('columnheader');
    expect(headers.map((header) => header.textContent)).toEqual([
      'Emp ID',
      'Employee Name',
      'Assigned Stores',
      'Shift',
      'Contact',
      'Type',
      'Email',
      'Gender',
      'Status',
      'Actions',
    ]);
    headers.forEach((header) => {
      expect(header.querySelector('button')).toBeNull();
    });
  });

  it('shows the store name for a single-store employee', () => {
    renderTable([baseEmployee({ stores: [{ id: 1, name: 'Downtown - Store 1' }] })]);

    expect(screen.getByText('Downtown - Store 1')).toBeInTheDocument();
  });

  it('collapses more than two assigned stores into a +N chip', () => {
    renderTable([
      baseEmployee({
        stores: [
          { id: 1, name: 'Downtown - Store 1' },
          { id: 2, name: 'River way - Store 2' },
          { id: 3, name: 'Uptown - Store 3' },
        ],
      }),
    ]);

    expect(screen.getByText('Downtown - Store 1')).toBeInTheDocument();
    expect(screen.getByText('River way - Store 2')).toBeInTheDocument();
    expect(screen.queryByText('Uptown - Store 3')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toHaveAttribute('title', 'Uptown - Store 3');
  });

  it('shows a placeholder chip when an employee has no assigned stores', () => {
    renderTable([baseEmployee({ stores: [] })]);

    expect(screen.getByText('No stores')).toBeInTheDocument();
  });

  it('renders the supplied empty message when there are no rows', () => {
    renderTable([], { emptyMessage: 'No employees yet. Add one to get started.' });

    expect(screen.getByText('No employees yet. Add one to get started.')).toBeInTheDocument();
  });

  it('shows the loading message instead of the empty message while loading', () => {
    renderTable([], { isLoading: true, emptyMessage: 'No employees match your filters.' });

    expect(screen.getByText('Loading employees...')).toBeInTheDocument();
    expect(screen.queryByText('No employees match your filters.')).not.toBeInTheDocument();
  });

  it('calls onToggleStatus when the row status switch is clicked', async () => {
    const onToggleStatus = vi.fn();
    const employee = baseEmployee({ active: true });
    renderTable([employee], { onToggleStatus });

    const toggle = screen.getByLabelText('Deactivate Asha Rao');
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);

    expect(onToggleStatus).toHaveBeenCalledWith(employee);
  });

  it('renders direct Edit and Delete icon buttons instead of a menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const employee = baseEmployee();
    renderTable([employee], { onEdit, onDelete });

    await userEvent.click(screen.getByRole('button', { name: /edit asha rao/i }));
    expect(onEdit).toHaveBeenCalledWith(employee);

    await userEvent.click(screen.getByRole('button', { name: /delete asha rao/i }));
    expect(onDelete).toHaveBeenCalledWith(employee);
  });
});
