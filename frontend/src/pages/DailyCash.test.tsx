import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import DailyCash from './DailyCash';
import * as storeCashApi from '../api/storeCash';
import { ApiError } from '../api/client';
import { nfToast } from '../utils/toast';
import { isTouchDevice } from '../utils/autoFocus';
import * as meCashApi from '../api/meCash';
import type { DailyCashEntry } from '../types/storeCash';

vi.mock('../utils/autoFocus', () => ({ isTouchDevice: vi.fn(() => false) }));
vi.mock('../api/storeCash', () => ({
  getDailyCashEntry: vi.fn(),
  saveDailyCashEntry: vi.fn(),
  getSuperAdminDailyCashEntry: vi.fn(),
  saveSuperAdminDailyCashEntry: vi.fn(),
  getExpectedCashAsOf: vi.fn(),
  getSuperAdminExpectedCashAsOf: vi.fn(),
  getCashHistory: vi.fn().mockResolvedValue({ storeId: 7, from: '', to: '', events: [] }),
  getSuperAdminCashHistory: vi.fn().mockResolvedValue({ storeId: 7, from: '', to: '', events: [] }),
  flagCashEntry: vi.fn(),
  editCashFlag: vi.fn(),
  removeCashFlag: vi.fn(),
}));
vi.mock('../api/meCash', () => ({
  getMyCashEntry: vi.fn(),
  saveMyCashEntry: vi.fn(),
}));
vi.mock('../api/storeCashTarget', () => ({
  getCashTarget: vi.fn().mockResolvedValue({ storeId: 7, targetAmount: 250, updatedByUserId: null, updatedBySuperAdminId: null, updatedAt: '2026-11-01T00:00:00Z' }),
  getSuperAdminCashTarget: vi.fn().mockResolvedValue({ storeId: 7, targetAmount: 250, updatedByUserId: null, updatedBySuperAdminId: null, updatedAt: '2026-11-01T00:00:00Z' }),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const LABELS = [
  'Opening drawer cash',
  'Cash removed',
  'Cash remaining',
  'Other adjustments',
];

function entry(overrides: Partial<DailyCashEntry> = {}): DailyCashEntry {
  return {
    id: 1,
    storeId: 7,
    businessDate: '2026-11-09',
    openingDrawerCash: 200,
    cashRemoved: 500,
    cashRemaining: 934.5,
    otherAdjustments: -12.25,
    enteredByUserId: 3,
    enteredBySuperAdminId: null,
    enteredByName: 'Sam Employee',
    enteredAt: '2026-11-09T18:00:00Z',
    updatedByUserId: 3,
    updatedBySuperAdminId: null,
    updatedByName: 'Sam Employee',
    updatedAt: '2026-11-09T18:00:00Z',
    history: [],
    correctedByName: null,
    correctedAt: null,
    correctedByRole: null,
    status: 'Entered',
    flag: null,
    resolvedFlag: null,
    canEdit: null,
    ...overrides,
  };
}

const FLAG = {
  id: 4,
  comment: 'Cash removed looks too high for a Tuesday',
  flaggedByName: 'Olive Owner',
  flaggedByRole: 'OWNER_ADMIN' as const,
  flaggedAt: '2026-11-09T19:00:00Z',
  commentUpdatedAt: null,
  resolvedByName: null,
  resolvedAt: null,
  resolution: null,
  resolutionNote: null,
};

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
  vi.mocked(storeCashApi.getExpectedCashAsOf).mockReset().mockResolvedValue({ storeId: 7, asOf: todayIso(), expectedCashOnHand: 0 });
  vi.mocked(meCashApi.getMyCashEntry).mockReset().mockResolvedValue(null);
  vi.mocked(meCashApi.saveMyCashEntry).mockReset();
  vi.mocked(isTouchDevice).mockReturnValue(false);
  vi.mocked(nfToast.success).mockReset();
  vi.mocked(nfToast.error).mockReset();
});

describe('DailyCash', () => {
  it('shows the store cash target as a read-only value with no way to edit it', async () => {
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText('$250.00')).toBeInTheDocument();
    expect(screen.getByText('Cash target')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /cash target/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cash target/i)).not.toBeInTheDocument();
  });

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
    const formula = screen.getByText(/Daily expected cash = Cash remaining ± Other adjustments/);
    expect(formula).toHaveClass('daily-cash-page__formula-banner');
    const savedStatus = screen.getByText('No entry saved for this date yet');
    const toolbar = savedStatus.closest('.daily-cash-page__toolbar');
    expect(toolbar).not.toBeNull();
    expect(toolbar).not.toContainElement(formula);
    expect(formula.compareDocumentPosition(toolbar as Node) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('shows who first entered the saved entry', async () => {
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(entry());
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText(/^Entered by Sam Employee ·/)).toBeInTheDocument();
  });

  it('shows "Unknown" for an entry from before the creator was recorded', async () => {
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(
      entry({ enteredByUserId: null, enteredBySuperAdminId: null, enteredByName: null }),
    );
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText(/^Entered by Unknown ·/)).toBeInTheDocument();
  });

  it('shows exactly the four fields, in the agreed order', async () => {
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    const inputs = Array.from(document.querySelectorAll<HTMLInputElement>('input[id^="daily-cash-"]'))
      .filter((input) => input.id !== 'daily-cash-date');
    expect(inputs.map((input) => input.id)).toEqual([
      'daily-cash-openingDrawerCash',
      'daily-cash-cashRemoved',
      'daily-cash-cashRemaining',
      'daily-cash-otherAdjustments',
    ]);
    expect(screen.queryByLabelText(/^Total cash sales/)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/^Bank deposits/)).not.toBeInTheDocument();
  });

  it('opens input help in a modal on touch devices', async () => {
    vi.mocked(isTouchDevice).mockReturnValue(true);
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await user.click(screen.getByLabelText('Help for Opening drawer cash'));
    expect(await screen.findByRole('dialog')).toHaveTextContent('Cash in the drawer at the start of the day');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('pre-fills the saved entry when the date already has one', async () => {
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(entry());
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText(/^Saved · last updated/)).toBeInTheDocument();
    expect(field('Cash remaining')).toHaveValue('934.50');
    expect(field('Opening drawer cash')).toHaveValue('200.00');
    expect(field('Other adjustments')).toHaveValue('-12.25');
    expect(screen.getByRole('button', { name: 'Update Entry' })).toBeInTheDocument();
  });

  it('needs a reason to correct a saved day, then sends it and shows who corrected it', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(entry());
    vi.mocked(storeCashApi.saveDailyCashEntry).mockImplementation(async (request) => entry({
      ...request,
      correctedByName: 'Priya Admin',
      correctedAt: '2026-11-10T09:30:00Z',
      history: [{
        id: 1,
        previousOpeningDrawerCash: 200, previousCashRemoved: 500,
        previousCashRemaining: 934.5, previousOtherAdjustments: -12.25,
        newOpeningDrawerCash: 1300, newCashRemoved: 500,
        newCashRemaining: 934.5, newOtherAdjustments: -12.25,
        correctedByName: 'Priya Admin', correctedAt: '2026-11-10T09:30:00Z', reason: 'Opening cash keyed in wrong',
      }],
    }));
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText(/^Saved · last updated/);

    await user.clear(field('Opening drawer cash'));
    await user.type(field('Opening drawer cash'), '1300');
    await user.click(screen.getByRole('button', { name: 'Update Entry' }));

    expect(screen.getByText('Enter a reason for this correction')).toBeInTheDocument();
    expect(storeCashApi.saveDailyCashEntry).not.toHaveBeenCalled();

    await user.type(screen.getByRole('textbox', { name: /reason for correction/i }), 'Opening cash keyed in wrong');
    await user.click(screen.getByRole('button', { name: 'Update Entry' }));

    const request = vi.mocked(storeCashApi.saveDailyCashEntry).mock.calls[0][0];
    expect(request.openingDrawerCash).toBe(1300);
    expect(request.correctionReason).toBe('Opening cash keyed in wrong');
    expect((await screen.findAllByText(/^Corrected by Priya Admin ·/)).length).toBe(2); // status line + history
    const history = screen.getByRole('region', { name: 'Correction history' });
    expect(history).toHaveTextContent('Reason: Opening cash keyed in wrong');
    expect(history).toHaveTextContent('Opening drawer cash: $200.00 → $1,300.00');
  });

  it('does not send a request when a saved day is re-saved unchanged', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(entry());
    vi.mocked(storeCashApi.saveDailyCashEntry).mockImplementation(async (request) => entry({ ...request }));
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText(/^Saved · last updated/);

    await user.click(screen.getByRole('button', { name: 'Update Entry' }));

    expect(screen.queryByText('Enter a reason for this correction')).not.toBeInTheDocument();
    expect(await screen.findByText('No changes to save')).toBeInTheDocument();
    expect(vi.mocked(storeCashApi.saveDailyCashEntry)).not.toHaveBeenCalled();
  });

  it('starts blank, with no mandatory field, and only asks for at least one amount', async () => {
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(field('Opening drawer cash')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(screen.getByText('Enter an amount to save')).toBeInTheDocument();
    expect(storeCashApi.saveDailyCashEntry).not.toHaveBeenCalled();
  });

  it('requires the opening drawer cash before any other amount', async () => {
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await user.type(field('Cash remaining'), '10');
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(await screen.findByText('Enter the opening drawer cash first')).toBeInTheDocument();
    expect(storeCashApi.saveDailyCashEntry).not.toHaveBeenCalled();
  });

  it('lets an admin save just the opening and one other amount, sending only what was filled in', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.saveDailyCashEntry).mockImplementation(async (request) =>
      entry({ ...request, cashRemoved: null, otherAdjustments: 0 }));
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await user.type(field('Opening drawer cash'), '5');
    await user.type(field('Cash remaining'), '10');
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(storeCashApi.saveDailyCashEntry).toHaveBeenCalledTimes(1);
    const request = vi.mocked(storeCashApi.saveDailyCashEntry).mock.calls[0][0];
    expect(request.cashRemaining).toBe(10);
    expect(request.openingDrawerCash).toBe(5);
    expect(request).not.toHaveProperty('cashRemoved');
    expect(request).not.toHaveProperty('otherAdjustments');
  });

  it('does not ask an owner for a reason when filling in a figure that was never recorded', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(entry({ cashRemoved: null }));
    vi.mocked(storeCashApi.saveDailyCashEntry).mockImplementation(async (request) => entry({ ...request }));
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText(/^Saved · last updated/);

    await user.type(field('Cash removed'), '40');
    await user.click(screen.getByRole('button', { name: 'Update Entry' }));

    expect(screen.queryByText('Enter a reason for this correction')).not.toBeInTheDocument();
    const request = vi.mocked(storeCashApi.saveDailyCashEntry).mock.calls[0][0];
    expect(request.cashRemoved).toBe(40);
    expect(request.correctionReason).toBeUndefined();
  });

  it('marks no field as required for an owner', async () => {
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    for (const label of LABELS) {
      expect((field(label).closest('.form-field') as HTMLElement).querySelector('.form-field__required')).toBeNull();
    }
  });

  it('still rejects a typed non-numeric Other adjustments', async () => {
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await fillAll(user);
    await user.clear(field('Other adjustments'));
    await user.type(field('Other adjustments'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(screen.getByText('Other adjustments must be a number, e.g. 125.50')).toBeInTheDocument();
    expect(storeCashApi.saveDailyCashEntry).not.toHaveBeenCalled();
  });

  it('flags non-numeric and negative amounts, but allows a negative adjustment', async () => {
    const user = userEvent.setup();
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await fillAll(user);
    await user.clear(field('Opening drawer cash'));
    await user.type(field('Opening drawer cash'), 'abc');
    await user.clear(field('Cash removed'));
    await user.type(field('Cash removed'), '-5');
    await user.clear(field('Cash remaining'));
    await user.type(field('Cash remaining'), '1.234');
    await user.clear(field('Other adjustments'));
    await user.type(field('Other adjustments'), '-5');
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(screen.getByText('Opening drawer cash must be a number, e.g. 125.50')).toBeInTheDocument();
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
    expect(request.openingDrawerCash).toBe(1000.5);
    expect(request.otherAdjustments).toBe(-2);
    expect(nfToast.success).toHaveBeenCalledWith(expect.stringMatching(/^Cash entry for .+ saved\.$/));
    expect(await screen.findByText(/^Saved · last updated/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Entry' })).toBeInTheDocument();
  });

  it('does not let a future business date be picked, so nothing for it is loaded or saved', async () => {
    // The date field is a themed calendar button (PopoverDateField), not a text
    // input, so a future date can only be reached through the calendar, whose
    // cells after `max` (today) are disabled.
    vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 5, 15, 12, 0, 0) });
    try {
      const user = userEvent.setup();
      render(<DailyCash storeId={7} storesLoading={false} />);
      await screen.findByText('No entry saved for this date yet');
      vi.mocked(storeCashApi.getDailyCashEntry).mockClear();

      await user.click(screen.getByLabelText('Business date'));
      const dialog = await screen.findByRole('dialog', { name: 'Choose a date' });

      expect(within(dialog).getByRole('button', { name: '15' })).toBeEnabled();
      expect(within(dialog).getByRole('button', { name: '16' })).toBeDisabled();
      expect(within(dialog).getByRole('button', { name: '30' })).toBeDisabled();
      expect(storeCashApi.getDailyCashEntry).not.toHaveBeenCalled();
      expect(storeCashApi.saveDailyCashEntry).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
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
        cashRemaining: 'Cash remaining looks wrong',
        businessDate: 'Business date is invalid',
      }),
    );
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('No entry saved for this date yet');

    await fillAll(user);
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(await screen.findByText('Cash remaining looks wrong')).toBeInTheDocument();
    expect(field('Cash remaining')).toHaveAttribute('aria-invalid', 'true');
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
    expect(storeCashApi.getExpectedCashAsOf).not.toHaveBeenCalled();
  });

  // ---- Expected Cash on Hand as of the viewed date (RTS-554) --------------------

  it('shows the server\'s running total as of the viewed date, even with no entry that day', async () => {
    vi.mocked(storeCashApi.getExpectedCashAsOf).mockResolvedValue({ storeId: 7, asOf: todayIso(), expectedCashOnHand: 1234.5 });
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText('$1,234.50')).toBeInTheDocument();
    expect(screen.getByText('Expected Cash on Hand')).toBeInTheDocument();
    expect(screen.getByText('No entry saved for this date yet')).toBeInTheDocument();
    expect(storeCashApi.getExpectedCashAsOf).toHaveBeenCalledWith(todayIso(), expect.anything());
  });

  it('refreshes Expected Cash on Hand from the server after a successful save', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.getExpectedCashAsOf)
      .mockResolvedValueOnce({ storeId: 7, asOf: todayIso(), expectedCashOnHand: 0 })
      .mockResolvedValueOnce({ storeId: 7, asOf: todayIso(), expectedCashOnHand: 540 });
    vi.mocked(storeCashApi.saveDailyCashEntry).mockImplementation(async (request) => entry({ ...request }));
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('$0.00');

    await fillAll(user);
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(await screen.findByText('$540.00')).toBeInTheDocument();
    expect(storeCashApi.getExpectedCashAsOf).toHaveBeenCalledTimes(2);
  });

  it('does not refetch Expected Cash on Hand when the save fails', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.saveDailyCashEntry).mockRejectedValue(new Error('Store not found'));
    render(<DailyCash storeId={7} storesLoading={false} />);
    await screen.findByText('$0.00');

    await fillAll(user);
    await user.click(screen.getByRole('button', { name: 'Save Entry' }));

    expect(await screen.findByText('Not saved: Store not found')).toBeInTheDocument();
    expect(storeCashApi.getExpectedCashAsOf).toHaveBeenCalledTimes(1);
  });

  it('keeps the entry form usable when Expected Cash on Hand cannot be loaded', async () => {
    vi.mocked(storeCashApi.getExpectedCashAsOf).mockRejectedValue(new Error('Network down'));
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText('Unavailable')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Save Entry' })).toBeEnabled();
  });

  // ---- Flags (RTS-556) ----------------------------------------------------------

  it('shows an open flag with its comment, who flagged it and when, and lets the owner edit or remove it', async () => {
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(entry({ status: 'Flagged', flag: FLAG }));
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText(/Cash removed looks too high for a Tuesday/)).toBeInTheDocument();
    expect(screen.getByText('Flagged')).toBeInTheDocument();
    expect(screen.getByText(/Flagged by Olive Owner/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit flag comment' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove flag' })).toBeInTheDocument();
  });

  it('requires a comment to flag an entry, then flags it', async () => {
    const user = userEvent.setup();
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(entry());
    vi.mocked(storeCashApi.flagCashEntry).mockResolvedValue(entry({ status: 'Flagged', flag: FLAG }));
    render(<DailyCash storeId={7} storesLoading={false} />);

    await user.click(await screen.findByRole('button', { name: 'Flag entry' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Flag entry' }));
    expect(await screen.findByText('Please enter a comment.')).toBeInTheDocument();
    expect(storeCashApi.flagCashEntry).not.toHaveBeenCalled();

    await user.clear(screen.getByLabelText(/Flag comment/));
    await user.type(screen.getByLabelText(/Flag comment/), 'Cash removed looks too high for a Tuesday');
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Flag entry' }));

    expect(storeCashApi.flagCashEntry).toHaveBeenCalledWith(1, 'Cash removed looks too high for a Tuesday');
    expect(await screen.findByText(/Flagged by Olive Owner/)).toBeInTheDocument();
  });

  it('shows "Resolved" once the employee has fixed a flagged entry, and offers to flag again', async () => {
    vi.mocked(storeCashApi.getDailyCashEntry).mockResolvedValue(entry({
      status: 'Corrected',
      correctedByName: 'Sam Employee',
      correctedByRole: 'EMPLOYEE',
      correctedAt: '2026-11-09T20:00:00Z',
      resolvedFlag: { ...FLAG, resolvedByName: 'Sam Employee', resolvedAt: '2026-11-09T20:00:00Z', resolution: 'EMPLOYEE_FIXED', resolutionNote: 'Recounted' },
    }));
    render(<DailyCash storeId={7} storesLoading={false} />);

    expect(await screen.findByText(/Resolved: corrected by employee Sam Employee/)).toBeInTheDocument();
    expect(screen.getByText(/Corrected by employee Sam Employee/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Flag again' })).toBeInTheDocument();
  });

  // ---- Employee view (RTS-557) --------------------------------------------------

  it('gives an employee two separate forms: opening drawer on its own, then the rest', async () => {
    const user = userEvent.setup();
    vi.mocked(meCashApi.saveMyCashEntry).mockImplementation(async (_storeId, request) =>
      entry({ cashRemoved: null, cashRemaining: null, otherAdjustments: 0, ...request, canEdit: true }));
    render(<DailyCash scope="employee" storeId={7} storesLoading={false} />);
    await screen.findAllByRole('button', { name: 'Save Entry' });

    const opening = screen.getByRole('form', { name: 'Opening drawer cash' });
    const rest = screen.getByRole('form', { name: 'Cash removed, cash remaining and adjustments' });
    expect(within(opening).getAllByRole('textbox')).toHaveLength(1);
    expect(within(opening).getByLabelText(/^Opening drawer cash/)).toBeInTheDocument();
    expect(within(rest).getAllByRole('textbox')).toHaveLength(3);
    expect(within(rest).queryByLabelText(/^Opening drawer cash/)).not.toBeInTheDocument();

    // Saving the opening form sends only the opening drawer cash.
    await user.type(within(opening).getByLabelText(/^Opening drawer cash/), '150');
    await user.click(within(opening).getByRole('button', { name: 'Save Entry' }));
    expect(meCashApi.saveMyCashEntry).toHaveBeenCalledTimes(1);
    const first = vi.mocked(meCashApi.saveMyCashEntry).mock.calls[0][1];
    expect(first.openingDrawerCash).toBe(150);
    expect(first).not.toHaveProperty('cashRemoved');
    expect(first).not.toHaveProperty('cashRemaining');
    expect(first).not.toHaveProperty('otherAdjustments');

    // The other form requires cash removed and cash remaining, not adjustments.
    await user.click(within(rest).getByRole('button', { name: /Save Entry|Update Entry/ }));
    expect(within(rest).getByText('Cash removed is required')).toBeInTheDocument();
    expect(within(rest).getByText('Cash remaining is required')).toBeInTheDocument();
    expect(within(rest).queryByText(/Other adjustments is required/)).not.toBeInTheDocument();
    expect(meCashApi.saveMyCashEntry).toHaveBeenCalledTimes(1);

    await user.type(within(rest).getByLabelText(/^Cash removed/), '30');
    await user.type(within(rest).getByLabelText(/^Cash remaining/), '120');
    await user.click(within(rest).getByRole('button', { name: /Save Entry|Update Entry/ }));
    expect(meCashApi.saveMyCashEntry).toHaveBeenCalledTimes(2);
    const second = vi.mocked(meCashApi.saveMyCashEntry).mock.calls[1][1];
    expect(second.cashRemoved).toBe(30);
    expect(second.cashRemaining).toBe(120);
    expect(second).not.toHaveProperty('openingDrawerCash');
    expect(second).not.toHaveProperty('otherAdjustments');
  });

  it('requires the opening drawer cash in the employee opening form', async () => {
    const user = userEvent.setup();
    render(<DailyCash scope="employee" storeId={7} storesLoading={false} />);
    await screen.findAllByRole('button', { name: 'Save Entry' });

    const opening = screen.getByRole('form', { name: 'Opening drawer cash' });
    await user.click(within(opening).getByRole('button', { name: 'Save Entry' }));

    expect(within(opening).getByText('Opening drawer cash is required')).toBeInTheDocument();
    expect(meCashApi.saveMyCashEntry).not.toHaveBeenCalled();
  });

  it('never shows an employee expected cash or the target', async () => {
    render(<DailyCash scope="employee" storeId={7} storesLoading={false} />);

    expect(await screen.findAllByRole('button', { name: 'Save Entry' })).toHaveLength(2);
    expect(screen.queryByText('Expected Cash on Hand')).not.toBeInTheDocument();
    expect(screen.queryByText('Cash target')).not.toBeInTheDocument();
    expect(storeCashApi.getExpectedCashAsOf).not.toHaveBeenCalled();
  });

  it('shows a flagged entry read-only to an employee who did not enter it', async () => {
    vi.mocked(meCashApi.getMyCashEntry).mockResolvedValue(entry({ status: 'Flagged', flag: FLAG, canEdit: false }));
    render(<DailyCash scope="employee" storeId={7} storesLoading={false} />);

    expect(await screen.findByText(/Only they can correct it/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Update Entry|Save & resolve flag/ })).not.toBeInTheDocument();
    const rest = screen.getByRole('form', { name: 'Cash removed, cash remaining and adjustments' });
    expect(within(rest).getByLabelText(/^Cash removed/)).toBeDisabled();
  });

  it('lets the entering employee fix a flagged entry with an optional note, which resolves it', async () => {
    const user = userEvent.setup();
    vi.mocked(meCashApi.getMyCashEntry).mockResolvedValue(entry({ status: 'Flagged', flag: FLAG, canEdit: true }));
    vi.mocked(meCashApi.saveMyCashEntry).mockImplementation(async (_storeId, request) =>
      entry({ ...request, status: 'Corrected', canEdit: true }));
    render(<DailyCash scope="employee" storeId={7} storesLoading={false} />);

    expect(await screen.findByText(/Cash removed looks too high for a Tuesday/)).toBeInTheDocument();
    const rest = screen.getByRole('form', { name: 'Cash removed, cash remaining and adjustments' });
    await user.clear(within(rest).getByLabelText(/^Cash removed/));
    await user.type(within(rest).getByLabelText(/^Cash removed/), '450');
    await user.type(within(rest).getByRole('textbox', { name: /Note \(optional\)/ }), 'Recounted the drawer');
    await user.click(within(rest).getByRole('button', { name: 'Save & resolve flag' }));

    expect(meCashApi.saveMyCashEntry).toHaveBeenCalledWith(7, expect.objectContaining({
      cashRemoved: 450,
      correctionReason: 'Recounted the drawer',
    }));
    const request = vi.mocked(meCashApi.saveMyCashEntry).mock.calls[0][1];
    expect(request).not.toHaveProperty('openingDrawerCash');
  });

  it('keeps employee section notes and loading indicators independent', async () => {
    const user = userEvent.setup();
    vi.mocked(meCashApi.getMyCashEntry).mockResolvedValue(entry({ canEdit: true }));
    let resolveSave: ((saved: DailyCashEntry) => void) | undefined;
    vi.mocked(meCashApi.saveMyCashEntry).mockImplementation((_storeId, _request) =>
      new Promise((resolve) => { resolveSave = resolve; }));
    render(<DailyCash scope="employee" storeId={7} storesLoading={false} />);

    const opening = await screen.findByRole('form', { name: 'Opening drawer cash' });
    const rest = screen.getByRole('form', { name: 'Cash removed, cash remaining and adjustments' });
    const openingNote = within(opening).getByRole('textbox', { name: /Note \(optional\)/ });
    const restNote = within(rest).getByRole('textbox', { name: /Note \(optional\)/ });
    await user.type(openingNote, 'Opening note');
    await user.type(restNote, 'Cash note');
    expect(openingNote).toHaveValue('Opening note');
    expect(restNote).toHaveValue('Cash note');

    await user.clear(within(opening).getByLabelText(/^Opening drawer cash/));
    await user.type(within(opening).getByLabelText(/^Opening drawer cash/), '210');
    await user.click(within(opening).getByRole('button', { name: 'Update Entry' }));

    expect(await within(opening).findByRole('button', { name: 'Saving' })).toBeInTheDocument();
    expect(within(rest).getByRole('button', { name: 'Update Entry' })).toBeDisabled();
    expect(meCashApi.saveMyCashEntry).toHaveBeenCalledWith(7, expect.objectContaining({
      openingDrawerCash: 210,
      correctionReason: 'Opening note',
    }));
    const firstRequest = vi.mocked(meCashApi.saveMyCashEntry).mock.calls[0][1];
    expect(firstRequest).not.toHaveProperty('cashRemoved');

    resolveSave?.(entry({ openingDrawerCash: 210, canEdit: true }));
    await waitFor(() => expect(within(opening).getByRole('button', { name: 'Update Entry' })).toBeInTheDocument());
    expect(openingNote).toHaveValue('');
    expect(restNote).toHaveValue('Cash note');

    await user.clear(within(rest).getByLabelText(/^Cash removed/));
    await user.type(within(rest).getByLabelText(/^Cash removed/), '450');
    await user.click(within(rest).getByRole('button', { name: 'Update Entry' }));
    expect(await within(rest).findByRole('button', { name: 'Saving' })).toBeInTheDocument();
    expect(meCashApi.saveMyCashEntry).toHaveBeenLastCalledWith(7, expect.objectContaining({
      cashRemoved: 450,
      correctionReason: 'Cash note',
    }));

    resolveSave?.(entry({ openingDrawerCash: 210, cashRemoved: 450, canEdit: true }));
    await waitFor(() => expect(within(rest).getByRole('button', { name: 'Update Entry' })).toBeInTheDocument());
    expect(openingNote).toHaveValue('');
    expect(restNote).toHaveValue('');
  });

  it('reloads Daily Cash when a notification is opened for the selected date', async () => {
    const { rerender } = render(<DailyCash scope="employee" storeId={7} storesLoading={false} />);
    await screen.findAllByRole('button', { name: 'Save Entry' });
    expect(meCashApi.getMyCashEntry).toHaveBeenCalledTimes(1);

    rerender(<DailyCash
      scope="employee"
      storeId={7}
      storesLoading={false}
      dateSeed={{ date: todayIso(), id: 1 }}
    />);

    await waitFor(() => expect(meCashApi.getMyCashEntry).toHaveBeenCalledTimes(2));
    expect(meCashApi.getMyCashEntry).toHaveBeenLastCalledWith(7, todayIso(), expect.any(AbortSignal));
  });
});
