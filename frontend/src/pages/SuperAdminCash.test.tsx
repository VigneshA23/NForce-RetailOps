import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminCash from './SuperAdminCash';
import * as storeCashApi from '../api/storeCash';
import * as superAdminStoresApi from '../api/superAdminStores';
import type { SuperAdminStore } from '../types/superAdminStore';

vi.mock('../api/storeCash', () => ({
  getDailyCashEntry: vi.fn(),
  saveDailyCashEntry: vi.fn(),
  getSuperAdminDailyCashEntry: vi.fn(),
  saveSuperAdminDailyCashEntry: vi.fn(),
}));
vi.mock('../api/superAdminStores', () => ({ getAllStores: vi.fn() }));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function store(storeId: number, storeName: string, storeActive = true): SuperAdminStore {
  return {
    storeId,
    storeCode: 100 + storeId,
    storeName,
    storeLocation: null,
    storeActive,
    ownerId: null,
    ownerName: null,
    ownerActive: null,
    ownerAccessActive: false,
    employeeCount: 0,
    taskCount: 0,
  };
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(superAdminStoresApi.getAllStores).mockReset().mockResolvedValue([
    store(1, 'Downtown'),
    store(2, 'Uptown'),
    store(3, 'Closed Branch', false),
  ]);
  vi.mocked(storeCashApi.getSuperAdminDailyCashEntry).mockReset().mockResolvedValue(null);
  vi.mocked(storeCashApi.saveSuperAdminDailyCashEntry).mockReset();
  vi.mocked(storeCashApi.getDailyCashEntry).mockReset();
});

describe('SuperAdminCash', () => {
  it('asks for a store first, then loads and saves that store through the Super Admin API', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.saveSuperAdminDailyCashEntry).mockImplementation(async (storeId, request) => ({
      id: 9, storeId, ...request,
      enteredByUserId: null, enteredBySuperAdminId: 1, enteredAt: '2026-11-09T18:00:00Z',
      updatedByUserId: null, updatedBySuperAdminId: 1, updatedAt: '2026-11-09T18:00:00Z',
      history: [],
    }));
    render(<SuperAdminCash />);

    expect(await screen.findByText('Select a store to enter or review its daily cash.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Entry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Store' }));
    expect(screen.queryByRole('button', { name: /Closed Branch/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Uptown/ }));

    expect(await screen.findByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(storeCashApi.getSuperAdminDailyCashEntry).toHaveBeenCalledWith(2, expect.any(String), expect.anything());
    expect(storeCashApi.getDailyCashEntry).not.toHaveBeenCalled();

    for (const label of ['Total cash sales', 'Opening drawer cash', 'Cash removed', 'Cash remaining', 'Cash expenses', 'Bank deposits', 'Other adjustments']) {
      await user.type(screen.getByLabelText(new RegExp(`^${label}`)), '5');
    }
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(storeCashApi.saveSuperAdminDailyCashEntry).toHaveBeenCalledWith(2, expect.objectContaining({ totalCashSales: 5 }));
    expect(await screen.findByRole('button', { name: 'Update Entry' })).toBeInTheDocument();
  });

  it('reopens the store picked last time', async () => {
    localStorage.setItem('nforce-retailops-page:sa-cash-store', '1');
    render(<SuperAdminCash />);

    expect(await screen.findByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(storeCashApi.getSuperAdminDailyCashEntry).toHaveBeenCalledWith(1, expect.any(String), expect.anything());
  });
});
