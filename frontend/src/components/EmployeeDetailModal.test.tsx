import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmployeeDetailModal from './EmployeeDetailModal';
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
    stores: [{ id: 1, name: 'Downtown - Store 1' }],
    ...overrides,
  };
}

function renderModal(props: Partial<Parameters<typeof EmployeeDetailModal>[0]> = {}) {
  return render(<EmployeeDetailModal employee={baseEmployee()} onClose={vi.fn()} {...props} />);
}

describe('EmployeeDetailModal', () => {
  it('shows the read-only fields, including the ones hidden from the table', () => {
    renderModal();

    expect(screen.getByText('Downtown - Store 1')).toBeInTheDocument();
    expect(screen.getByText(/Morning/)).toBeInTheDocument();
    expect(screen.getByText('Full Time')).toBeInTheDocument();
    expect(screen.getByText('+91 9876543210')).toBeInTheDocument();
    expect(screen.getByText('asha@example.com')).toBeInTheDocument();
    expect(screen.getByText('Female')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('has no Edit button, only Close', async () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when employee is null', () => {
    const { container } = renderModal({ employee: null });

    expect(container).toBeEmptyDOMElement();
  });
});
