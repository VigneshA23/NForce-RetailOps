import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DailyCash from './DailyCash';
import * as storeCashApi from '../api/storeCash';
import { ApiError } from '../api/client';
import { nfToast } from '../utils/toast';
import { isTouchDevice } from '../utils/autoFocus';
import type { DailyCashEntry, ExpectedCash } from '../types/storeCash';

vi.mock('../utils/autoFocus', () => ({ isTouchDevice: vi.fn(() => false) }));
vi.mock('../api/storeCash', () => ({
  getDailyCashEntry: vi.fn(),
  saveDailyCashEntry: vi.fn(),
  getSuperAdminDailyCashEntry: vi.fn(),
  saveSuperAdminDailyCashEntry: vi.fn(),
  getExpectedCash: vi.fn(),
  getSuperAdminExpectedCash: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const LABELS = [
  'Total cash sales',
  'Opening drawer cash',
  'Cash removed',
  'Cash remaining',
  'Cash expenses',
  'Bank deposits',
  'Other adjustments',
];

function entry(overrides: Partial<DailyCashEntry> = {}): DailyCashEntry {
  return {
    id: 1,
    storeId: 7,
    businessDate: '2026-11-09',
    totalCashSales: 1234.5,
    openingDrawerCash: 200,
    cashRemoved: 500,
    cashRemaining: 934.5,
    cashExpenses: 0,
    bankDeposits: 500,
    otherAdjustments: -12.25,
    enteredByUserId: 3,
    enteredBySuperAdminId: null,
    enteredAt: '2026-11-09T18:00:00Z',
    updatedByUserId: 3,
    updatedBySuperAdminId: null,
    updatedAt: '2026-11-09T18:00:00Z',
    history: [],
    ...overrides,
  };
}

function expected(overrides: Partial<ExpectedCash> = {}): ExpectedCash {
  return {
    storeId: 7, available: false, message: 'No cash entries have been recorded for this store yet', asOfDate: null, lastUpdatedAt: null,
    expectedCashOnHand: null, cashRemaining: null, variance: null, openingDrawerCash: null, totalCashSales: null,
    cashRemoved: null, bankDeposits: null, cashExpenses: null, otherAdjustments: null,
    ...overrides,
  };
}

function todayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(new RegExp(`^${label}`)) as HTMLInputElement;
}

async function fillAll(user: ReturnType<typeof userEvent.setup>, value = '10') {
  for (const label of LABELS) {
    await user.clear(field(label));
    await user.type(field(label), value);
  }
}

beforeEach(() => {
  vi.mocked(storeCashApi.getDailyCashEntry).mockReset().mockResolvedValue(null);
  vi.mocked(storeCashApi.saveDailyCashEntry).mockReset();
  vi.mocked(storeCashApi.getExpectedCash).mockReset().mockResolvedValue(expected());
  vi.mocked(isTouchDevice).mockReturnValue(false);
  vi.mocked(nfToast.success).mockReset();
  vi.mocked(nfToast.error).mockReset();
});

describe('DailyCash', () => {
  it('shows hover help for each cash input and places the formula in a full-width banner below the date row', async () => {
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    for (const label of LABELS) {
      const help = screen.getByLabelText(`Help for ${label}`);
      expect(help).toBeInTheDocument();
      await user.hover(help);
      expect(within(help).getByRole('tooltip')).toHaveTextContent(/\w+/);
    }

    expect(screen.queryByLabelText('Help for Business date')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Help for Expected Cash on Hand')).not.toBeInTheDocument();
    const formula = screen.getByText('Expected Cash = Opening Cash + Cash Sales − Cash Removed − Bank Deposits − Cash Expenses ± Other Adjustments');
    expect(formula).toHaveClass('daily-cash-page__formula-banner');
    const savedStatus = screen.getByText('No entry saved for this date yet');
    const toolbar = savedStatus.closest('.daily-cash-page__toolbar');
    expect(toolbar).not.toBeNull();
    expect(toolbar).not.toContainElement(formula);
    expect(formula.compareDocumentPosition(toolbar as Node) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('opens input help in a modal on touch devices', async () => {
    vi.mocked(isTouchDevice).mockReturnValue(true);
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await user.click(screen.getByLabelText('Help for Total cash sales'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Cash payments received from sales');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pre-fills the saved entry when the date already has one', async () => {
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(entry());
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText(/^Saved · last updated/)).toBeInTheDocument();
    expect(field('Total cash sales')).toHaveValue('1,234.50');
    expect(field('Opening drawer cash')).toHaveValue('200.00');
    expect(field('Other adjustments')).toHaveValue('-12.25');
    expect(screen.getByRole('button', { name: 'Update Entry' })).toBeInTheDocument();
  });

  it('starts blank when nothing is saved and refuses to save until every field is valid', async () => {
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(field('Total cash sales')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(screen.getByText('Total cash sales is required')).toBeInTheDocument();
    expect(screen.getByText('Other adjustments is required (enter 0 if none)')).toBeInTheDocument();
    expect(screen.getByText('Fix the 7 highlighted fields to save.')).toBeInTheDocument();
    expect(storeCashApi.saveDailyCashEntry).not.toHaveBeenCalled();
  });

  it('flags non-numeric and negative amounts, but allows a negative adjustment', async () => {
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await fillAll(user);
    await user.clear(field('Total cash sales'));
    await user.type(field('Total cash sales'), 'abc');
    await user.clear(field('Cash removed'));
    await user.type(field('Cash removed'), '-5');
    await user.clear(field('Bank deposits'));
    await user.type(field('Bank deposits'), '1.234');
    await user.clear(field('Other adjustments'));
    await user.type(field('Other adjustments'), '-5');
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(screen.getByText('Total cash sales must be a number, e.g. 125.50')).toBeInTheDocument();
    expect(screen.getByText('Cash removed cannot be negative')).toBeInTheDocument();
    expect(screen.getByText('Use at most 2 decimal places')).toBeInTheDocument();
    expect(screen.queryByText(/Other adjustments cannot be negative/)).not.toBeInTheDocument();
    expect(storeCashApi.saveDailyCashEntry).not.toHaveBeenCalled();

    // Fixing a field clears its message without another save attempt.
    await user.clear(field('Cash removed'));
    await user.type(field('Cash removed'), '5');
    expect(screen.queryByText('Cash removed cannot be negative')).not.toBeInTheDocument();
  });

  it('saves the amounts as numbers for the chosen date and confirms', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.saveDailyCashEntry).mockImplementation(async (request) => entry({ ...request }));
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await fillAll(user, '1,000.5');
    await user.clear(field('Other adjustments'));
    await user.type(field('Other adjustments'), '-2');
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(storeCashApi.saveDailyCashEntry).toHaveBeenCalledTimes(1);
    const request = vi.mocked(storeCashApi.saveDailyCashEntry).mock.calls[0][0];
    expect(request.businessDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(request.totalCashSales).toBe(1000.5);
    expect(request.otherAdjustments).toBe(-2);
    expect(nfToast.success).toHaveBeenCalledWith(expect.stringMatching(/^Cash entry for .+ saved\.$/));
    expect(await screen.findByText(/^Saved · last updated/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Entry' })).toBeInTheDocument();
  });

  it('refuses a typed-in future business date and does not save it', async () => {
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');
    await fillAll(user);
    vi.mocked(storeCashApi.getDailyCashEntry).mockClear();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowIso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    fireEvent.change(screen.getByLabelText('Business date'), { target: { value: tomorrowIso } });

    expect(await screen.findByText('Business date cannot be in the future')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Entry' })).toBeDisabled();
    expect(storeCashApi.getDailyCashEntry).not.toHaveBeenCalled();
    expect(storeCashApi.saveDailyCashEntry).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Business date'), { target: { value: todayIso() } });
    expect(await screen.findByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(screen.queryByText('Business date cannot be in the future')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Entry' })).toBeEnabled();
  });

  it('shows an error and does not mark the day as saved when the save fails', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.saveDailyCashEntry).mockRejectedValue(new Error('Store not found'));
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await fillAll(user);
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(await screen.findByText('Not saved: Store not found')).toBeInTheDocument();
    expect(nfToast.error).toHaveBeenCalled();
    expect(nfToast.success).not.toHaveBeenCalled();
    expect(screen.getByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Entry' })).toBeInTheDocument();
  });

  it('shows the server\'s own field messages under the matching inputs when it rejects a save', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.saveDailyCashEntry).mockRejectedValue(
      new ApiError(400, 'Something went wrong. Please try again.', {
        cashExpenses: 'Cash expenses cannot be negative',
        businessDate: 'Business date is invalid',
      }),
    );
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await fillAll(user);
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(await screen.findByText('Cash expenses cannot be negative')).toBeInTheDocument();
    expect(field('Cash expenses')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Not saved: Business date is invalid')).toBeInTheDocument();
    expect(screen.queryByText(/Something went wrong/)).not.toBeInTheDocument();
    expect(screen.getByText('No entry saved for this date yet')).toBeInTheDocument();
  });

  it('hides the form and offers a retry when the entry cannot be loaded', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.getDailyCashEntry)
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce(null);
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText('Network down')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Entry' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('button', { name: 'Save Entry' })).toBeInTheDocument();
  });

  it('explains when the owner has no store', () => {
    render(<DailyCash storeId={null} storesLoading={false} />);

    expect(screen.getByText(/No store is assigned to your account yet/)).toBeInTheDocument();
    expect(storeCashApi.getDailyCashEntry).not.toHaveBeenCalled();
    // No store, no Expected Cash on Hand card.
    expect(screen.queryByText('Expected Cash on Hand')).not.toBeInTheDocument();
    expect(storeCashApi.getExpectedCash).not.toHaveBeenCalled();
  });

  // ---- Expected Cash on Hand (RTS-296) ----------------------------------------

  it('shows "No data yet" for a store with no cash entries, never $0.00', async () => {
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText('No data yet')).toBeInTheDocument();
    expect(screen.getByText('Expected Cash on Hand')).toBeInTheDocument();
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('refreshes Expected Cash on Hand from the server after a successful save', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.getExpectedCash)
      .mockResolvedValueOnce(expected())
      .mockResolvedValueOnce(expected({ available: true, message: null, asOfDate: todayIso(), expectedCashOnHand: 540 }));
    vi.mocked(storeCashApi.saveDailyCashEntry).mockImplementation(async (request) => entry({ ...request }));
    render(<DailyCash storeId={7} storesLoading={false} />);
    expect(await screen.findByText('No data yet')).toBeInTheDocument();

    await fillAll(user);
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(await screen.findByText('$540.00')).toBeInTheDocument();
    expect(screen.queryByText('No data yet')).not.toBeInTheDocument();
    expect(storeCashApi.getExpectedCash).toHaveBeenCalledTimes(2);
  });

  it('does not refetch Expected Cash on Hand when the save fails', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.saveDailyCashEntry).mockRejectedValue(new Error('Store not found'));
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No data yet');

    await fillAll(user);
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(await screen.findByText('Not saved: Store not found')).toBeInTheDocument();
    expect(storeCashApi.getExpectedCash).toHaveBeenCalledTimes(1);
  });

  it('keeps the entry form usable when Expected Cash on Hand cannot be loaded', async () => {
    vi.mocked(storeCashApi.getExpectedCash).mockRejectedValue(new Error('Network down'));
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Save Entry' })).toBeEnabled();
  });
});
