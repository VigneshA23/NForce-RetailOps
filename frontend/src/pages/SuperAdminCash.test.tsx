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
  flagSuperAdminCashEntry: vi.fn(),
  editSuperAdminCashFlag: vi.fn(),
  removeSuperAdminCashFlag: vi.fn(),
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
      id: 9, storeId, openingDrawerCash: null, cashRemoved: null, cashRemaining: null, otherAdjustments: 0, ...request,
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

  function savedEntry(overrides: Record<string, unknown> = {}) {
    return {
      id: 9, storeId: 1, businessDate: '2026-11-09',
      openingDrawerCash: 100, cashRemoved: 10, cashRemaining: 90, otherAdjustments: 0,
      enteredByUserId: 5, enteredBySuperAdminId: null, enteredByName: 'Emma Employee', enteredAt: '2026-11-09T18:00:00Z',
      updatedByUserId: 5, updatedBySuperAdminId: null, updatedByName: 'Emma Employee', updatedAt: '2026-11-09T18:00:00Z',
      history: [], correctedByName: null, correctedAt: null, correctedByRole: null,
      status: 'Entered', flag: null, resolvedFlag: null, canEdit: null,
      ...overrides,
    };
  }

  it('shows who entered the day, asks to confirm an update, and gives no reason box or history', async () => {
    const user = userEvent.setup();
    localStorage.setItem('nforce-retailops-page:sa-cash-store', '1');
    vi.mocked(storeCashApi.getSuperAdminDailyCashEntry).mockResolvedValue(savedEntry() as never);
    vi.mocked(storeCashApi.saveSuperAdminDailyCashEntry).mockResolvedValue(
      savedEntry({ openingDrawerCash: 150, correctedByName: 'Sam Super', correctedAt: '2026-11-10T09:00:00Z' }) as never);
    render(<SuperAdminCash />);

    expect(await screen.findByText(/Entered by Emma Employee/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Reason for correction/i)).not.toBeInTheDocument();

    const opening = screen.getByLabelText(/^Opening drawer cash/);
    await user.clear(opening);
    await user.type(opening, '150');
    await user.click(screen.getByRole('button', { name: 'Update Entry' }));

    // Nothing is saved until the popup is confirmed.
    expect(storeCashApi.saveSuperAdminDailyCashEntry).not.toHaveBeenCalled();
    expect(await screen.findByText('Opening drawer cash: $100.00 → $150.00')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(storeCashApi.saveSuperAdminDailyCashEntry).toHaveBeenCalledWith(
      1, expect.objectContaining({ openingDrawerCash: 150 }));
    expect(storeCashApi.saveSuperAdminDailyCashEntry).toHaveBeenCalledWith(
      1, expect.not.objectContaining({ correctionReason: expect.anything() }));
  });

  it('flags an entry from a button beside Update, with a note of at least five words', async () => {
    const user = userEvent.setup();
    localStorage.setItem('nforce-retailops-page:sa-cash-store', '1');
    vi.mocked(storeCashApi.getSuperAdminDailyCashEntry).mockResolvedValue(savedEntry() as never);
    vi.mocked(storeCashApi.flagSuperAdminCashEntry).mockResolvedValue(savedEntry({
      status: 'Flagged',
      flag: {
        id: 3, comment: 'Drawer total looks too low today', flaggedByName: 'Sam Super', flaggedByRole: 'SUPER_ADMIN',
        flaggedAt: '2026-11-10T09:00:00Z', commentUpdatedAt: null, resolvedByName: null, resolvedAt: null,
        resolution: null, resolutionNote: null,
      },
    }) as never);
    render(<SuperAdminCash />);

    await screen.findByRole('button', { name: 'Update Entry' });
    await user.click(screen.getByRole('button', { name: 'Flag' }));
    await user.type(screen.getByRole('textbox', { name: /Note/ }), 'too short');
    await user.click(screen.getByRole('button', { name: 'Flag entry' }));
    expect(await screen.findByText('Please give at least 5 words of context.')).toBeInTheDocument();
    expect(storeCashApi.flagSuperAdminCashEntry).not.toHaveBeenCalled();

    await user.clear(screen.getByRole('textbox', { name: /Note/ }));
    await user.type(screen.getByRole('textbox', { name: /Note/ }), 'Drawer total looks too low today');
    await user.click(screen.getByRole('button', { name: 'Flag entry' }));

    expect(storeCashApi.flagSuperAdminCashEntry).toHaveBeenCalledWith(1, 9, 'Drawer total looks too low today');
    expect(await screen.findByText(/Flagged by Sam Super/)).toBeInTheDocument();
  });

  it('reopens the store picked last time', async () => {
    localStorage.setItem('nforce-retailops-page:sa-cash-store', '1');
    render(<SuperAdminCash />);

    expect(await screen.findByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(storeCashApi.getSuperAdminDailyCashEntry).toHaveBeenCalledWith(1, expect.any(String), expect.anything());
  });
});
