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
  getExpectedCashAsOf: vi.fn(),
  getSuperAdminExpectedCashAsOf: vi.fn(),
  getCashHistory: vi.fn(),
  getSuperAdminCashHistory: vi.fn(),
  flagCashEntry: vi.fn(),
  editCashFlag: vi.fn(),
  removeCashFlag: vi.fn(),
}));
vi.mock('../api/superAdminStores', () => ({ getAllStores: vi.fn() }));
vi.mock('../api/storeCashTarget', () => ({
  getCashTarget: vi.fn().mockResolvedValue({ storeId: 7, targetAmount: 250, updatedByUserId: null, updatedBySuperAdminId: null, updatedAt: '2026-11-01T00:00:00Z' }),
  getSuperAdminCashTarget: vi.fn().mockResolvedValue({ storeId: 7, targetAmount: 250, updatedByUserId: null, updatedBySuperAdminId: null, updatedAt: '2026-11-01T00:00:00Z' }),
}));
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
    cashTarget: null,
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
  vi.mocked(storeCashApi.getSuperAdminExpectedCashAsOf).mockReset()
    .mockImplementation(async (storeId: number, date: string) => ({ storeId, asOf: date, expectedCashOnHand: 75 }));
  vi.mocked(storeCashApi.getExpectedCashAsOf).mockReset();
});

describe('SuperAdminCash', () => {
  it('asks for a store first, then loads and saves that store through the Super Admin API', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.saveSuperAdminDailyCashEntry).mockImplementation(async (storeId, request) => ({
      id: 9, storeId, ...request,
      enteredByUserId: null, enteredBySuperAdminId: 1, enteredByName: 'Super Admin', enteredAt: '2026-11-09T18:00:00Z',
      updatedByUserId: null, updatedBySuperAdminId: 1, updatedByName: 'Super Admin', updatedAt: '2026-11-09T18:00:00Z',
      history: [], correctedByName: null, correctedAt: null,
      correctedByRole: null, status: 'Entered', flag: null, resolvedFlag: null, canEdit: null,
    }));
    render(<SuperAdminCash />);

    expect(await screen.findByText('Select a store to enter or review its daily cash.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Entry' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Help for Store')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Store' }));
    expect(screen.queryByRole('button', { name: /Closed Branch/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Uptown/ }));

    expect(await screen.findByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(storeCashApi.getSuperAdminDailyCashEntry).toHaveBeenCalledWith(2, expect.any(String), expect.anything());
    expect(storeCashApi.getDailyCashEntry).not.toHaveBeenCalled();
    // Expected Cash on Hand (as of the viewed date) reads the picked store, never the owner endpoint.
    expect(await screen.findByText('$75.00')).toBeInTheDocument();
    expect(storeCashApi.getSuperAdminExpectedCashAsOf).toHaveBeenCalledWith(2, expect.any(String), expect.anything());
    expect(storeCashApi.getExpectedCashAsOf).not.toHaveBeenCalled();

    for (const label of ['Opening drawer cash', 'Cash removed', 'Cash remaining', 'Other adjustments']) {
      await user.type(screen.getByLabelText(new RegExp(`^${label}`)), '5');
    }
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(storeCashApi.saveSuperAdminDailyCashEntry).toHaveBeenCalledWith(2, expect.objectContaining({ openingDrawerCash: 5 }));
    expect(await screen.findByRole('button', { name: 'Update Entry' })).toBeInTheDocument();
    // Refetched for the same store after the save.
    expect(storeCashApi.getSuperAdminExpectedCashAsOf).toHaveBeenLastCalledWith(2, expect.any(String), expect.anything());
    expect(vi.mocked(storeCashApi.getSuperAdminExpectedCashAsOf).mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('reopens the store picked last time', async () => {
    localStorage.setItem('nforce-retailops-page:sa-cash-store', '1');
    render(<SuperAdminCash />);

    expect(await screen.findByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(storeCashApi.getSuperAdminDailyCashEntry).toHaveBeenCalledWith(1, expect.any(String), expect.anything());
  });
});
