import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminCashReview from './SuperAdminCashReview';
import * as reviewApi from '../api/superAdminCashReview';
import * as superAdminStoresApi from '../api/superAdminStores';
import type { SuperAdminCashReview as Review } from '../types/superAdminCashReview';
import type { SuperAdminStore } from '../types/superAdminStore';

vi.mock('../api/superAdminCashReview', () => ({
  getSuperAdminCashReview: vi.fn(),
  correctSuperAdminCashEntry: vi.fn(),
  raiseSuperAdminCashFlag: vi.fn(),
  editSuperAdminCashFlag: vi.fn(),
  removeSuperAdminCashFlag: vi.fn(),
}));
vi.mock('../api/superAdminStores', () => ({ getAllStores: vi.fn() }));
vi.mock('../api/storeCash', () => ({
  getSuperAdminCashHistory: vi.fn().mockResolvedValue({ storeId: 1, from: '', to: '', events: [] }),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

function store(storeId: number, storeName: string): SuperAdminStore {
  return {
    storeId, storeCode: 100 + storeId, storeName, storeLocation: null, storeActive: true,
    ownerId: null, ownerName: null, ownerActive: null, ownerAccessActive: false,
    employeeCount: 0, taskCount: 0, cashTarget: null,
  };
}

function review(): Review {
  return {
    storeId: 1, storeName: 'Downtown', storeCode: '101', date: '2026-11-09',
    cashTarget: '250.00', expectedCashOnHand: '500.00',
    entry: {
      id: 5, storeId: 1, businessDate: '2026-11-09',
      openingDrawerCash: '200.00', cashRemoved: '50.00', cashRemaining: '300.00', otherAdjustments: '-12.25',
      enteredBy: null, enteredAt: '2026-11-09T18:00:00Z', updatedBy: null, updatedAt: '2026-11-09T18:00:00Z',
      status: 'Entered',
    },
    flag: null,
    history: [],
  };
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('nforce-retailops-page:sa-cash-review-store', '1');
  vi.mocked(superAdminStoresApi.getAllStores).mockReset().mockResolvedValue([store(1, 'Downtown')]);
  vi.mocked(reviewApi.getSuperAdminCashReview).mockReset().mockResolvedValue(review());
  vi.mocked(reviewApi.correctSuperAdminCashEntry).mockReset().mockResolvedValue(review());
});

describe('SuperAdminCashReview correction form', () => {
  it('accepts a blank Other adjustments and sends it as 0, without a Cash expenses field', { timeout: 20000 }, async () => {
    const user = userEvent.setup();
    render(<SuperAdminCashReview />);

    await user.click(await screen.findByRole('button', { name: 'Correct entry' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/Cash expenses/)).not.toBeInTheDocument();

    const other = within(dialog).getByLabelText(/^Other adjustments/);
    expect(within(dialog).getByLabelText(/^Cash removed/).closest('.form-field')!.querySelector('.form-field__required')).not.toBeNull();
    expect(other.closest('.form-field')!.querySelector('.form-field__required')).toBeNull();

    await user.clear(other);
    await user.type(within(dialog).getByRole('textbox', { name: /Reason for correction/ }), 'Adjustment was not needed');
    await user.click(within(dialog).getByRole('button', { name: 'Save correction' }));

    expect(screen.queryByText(/Other adjustments is required/)).not.toBeInTheDocument();
    expect(reviewApi.correctSuperAdminCashEntry).toHaveBeenCalledTimes(1);
    expect(vi.mocked(reviewApi.correctSuperAdminCashEntry).mock.calls[0][2]).toEqual({
      openingDrawerCash: 200, cashRemoved: 50, cashRemaining: 300, otherAdjustments: 0,
      reason: 'Adjustment was not needed',
    });
  });
});
