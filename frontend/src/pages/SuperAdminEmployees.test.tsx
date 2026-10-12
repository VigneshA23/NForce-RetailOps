import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminEmployees from './SuperAdminEmployees';
import * as superAdminEmployeesApi from '../api/superAdminEmployees';
import * as superAdminStoresApi from '../api/superAdminStores';
import * as employeesApi from '../api/employees';
import type { SuperAdminEmployee } from '../types/superAdminEmployee';

vi.mock('../api/superAdminEmployees', () => ({
  getAllEmployeesForSuperAdmin: vi.fn(),
  createEmployeeAsSuperAdmin: vi.fn(),
  updateEmployeeStores: vi.fn(),
}));
vi.mock('../api/superAdminStores', () => ({ getAllStores: vi.fn() }));
vi.mock('../api/employees', () => ({
  deleteEmployee: vi.fn(),
  setEmployeeStatus: vi.fn(),
  updateEmployee: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockGetAllEmployees = vi.mocked(superAdminEmployeesApi.getAllEmployeesForSuperAdmin);
const mockGetAllStores = vi.mocked(superAdminStoresApi.getAllStores);
const mockSetEmployeeStatus = vi.mocked(employeesApi.setEmployeeStatus);

function employee(overrides: Partial<SuperAdminEmployee> = {}): SuperAdminEmployee {
  return {
    id: 1,
    empId: 'E001',
    name: 'Ananya Reddyy',
    email: 'ananya@example.com',
    phone: '1234567890',
    employeeType: 'Full Time',
    gender: 'Female',
    active: true,
    stores: [],
    ownerId: 1,
    ownerName: 'Sam Owner',
    ...overrides,
  };
}

beforeEach(() => {
  mockGetAllEmployees.mockReset();
  mockGetAllStores.mockReset().mockResolvedValue([]);
  mockSetEmployeeStatus.mockReset();
});

describe('SuperAdminEmployees stat cards', () => {
  it('excludes inactive employees from Total, Full Time and Part Time from the start', async () => {
    mockGetAllEmployees.mockResolvedValue([
      employee({ id: 1, name: 'Ananya Reddyy', employeeType: 'Full Time', active: true }),
      employee({ id: 2, name: 'Priya Ramachandran', employeeType: 'Full Time', active: false }),
      employee({ id: 3, name: 'Rahul Verma', employeeType: 'Part Time', active: true }),
    ]);

    render(<SuperAdminEmployees />);
    await screen.findByText('Ananya Reddyy');

    const stats = screen.getByText('Total Employees').closest('.stat-card')!.parentElement!;
    expect(within(stats).getByText('Total Employees').closest('.stat-card')).toHaveTextContent('2');
    expect(within(stats).getByText('Full Time').closest('.stat-card')).toHaveTextContent('1');
    expect(within(stats).getByText('Part Time').closest('.stat-card')).toHaveTextContent('1');
    expect(within(stats).getByText('Inactive').closest('.stat-card')).toHaveTextContent('1');
  });

  it('updates Full Time and Total (not Part Time) when a Full Time employee is deactivated', async () => {
    const user = userEvent.setup();
    const ananya = employee({ id: 1, name: 'Ananya Reddyy', employeeType: 'Full Time', active: true });
    mockGetAllEmployees.mockResolvedValue([
      ananya,
      employee({ id: 2, name: 'Rahul Verma', employeeType: 'Part Time', active: true }),
    ]);
    mockSetEmployeeStatus.mockResolvedValue({ ...ananya, active: false });

    render(<SuperAdminEmployees />);
    await screen.findByText('Ananya Reddyy');

    const statsRow = screen.getByText('Total Employees').closest('.stat-card')!.parentElement!;
    expect(within(statsRow).getByText('Full Time').closest('.stat-card')).toHaveTextContent('1');
    expect(within(statsRow).getByText('Total Employees').closest('.stat-card')).toHaveTextContent('2');

    await user.click(screen.getByRole('checkbox', { name: 'Deactivate Ananya Reddyy' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      expect(within(statsRow).getByText('Total Employees').closest('.stat-card')).toHaveTextContent('1');
    });
    expect(within(statsRow).getByText('Full Time').closest('.stat-card')).toHaveTextContent('0');
    expect(within(statsRow).getByText('Part Time').closest('.stat-card')).toHaveTextContent('1');
    expect(within(statsRow).getByText('Inactive').closest('.stat-card')).toHaveTextContent('1');
  });
});
