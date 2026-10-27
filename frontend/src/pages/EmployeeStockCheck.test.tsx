import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EmployeeStockCheck from './EmployeeStockCheck';
import * as meApi from '../api/me';
import * as stockCheckApi from '../api/stockChecks';
import type { DailyStockCheckItem } from '../types/stockCheck';
import type { StoreSummary } from '../types/store';
import { nfToast } from '../utils/toast';

vi.mock('../api/me', () => ({ getMe: vi.fn() }));
vi.mock('../api/stockChecks', () => ({
  getTodayStockCheck: vi.fn(),
  reportAdHocShortage: vi.fn(),
  submitStockCheck: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockGetMe = vi.mocked(meApi.getMe);
const mockGetTodayStockCheck = vi.mocked(stockCheckApi.getTodayStockCheck);

const store: StoreSummary = { id: 1, name: 'Keds Ice Cream - Plano', location: null, status: 'Open' };

const item: DailyStockCheckItem = {
  storeInventoryItemId: 1,
  itemName: 'Milk',
  unitOfMeasurement: 'Nos.',
  minTarget: 8,
  requiredTomorrow: null,
  startOfDay: null,
  endOfDay: null,
  currentStock: null,
  stockUsed: null,
  quantityToOrder: null,
  imageId: null,
};

const savedSod = {
  available: 8,
  deadStock: 0,
  usable: 8,
  enteredById: 1,
  enteredByName: 'Ananya',
  enteredAt: '2026-10-22T09:00:00Z',
  lastUpdatedByName: 'Ananya',
  lastUpdatedByAvatarUrl: null,
  lastUpdatedAt: '2026-10-22T09:00:00Z',
  edited: false,
};

const savedEod = {
  ...savedSod,
  available: 10,
  usable: 10,
  enteredAt: '2026-10-22T17:00:00Z',
  lastUpdatedAt: '2026-10-22T17:00:00Z',
};

describe('EmployeeStockCheck available count after End of Day', () => {
  it('adds a delivery received after End of Day to the available count and drops the shortage', async () => {
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{
      ...item,
      itemName: 'Strawberry',
      minTarget: 9,
      startOfDay: savedSod,
      endOfDay: { ...savedEod, available: 4, usable: 4 },
      deliveredAfterEndOfDay: 20,
    }]);

    render(<EmployeeStockCheck store={store} />);

    expect(await screen.findByText('Strawberry')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
    expect(screen.queryByText(/Nos. Needed/)).not.toBeInTheDocument();
    expect(screen.getByText('Sufficient')).toBeInTheDocument();
  });

  it('still shows the shortage when no delivery came after End of Day', async () => {
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{
      ...item,
      itemName: 'Strawberry',
      minTarget: 9,
      startOfDay: savedSod,
      endOfDay: { ...savedEod, available: 4, usable: 4 },
      deliveredAfterEndOfDay: 0,
    }]);

    render(<EmployeeStockCheck store={store} />);

    expect(await screen.findByText('Strawberry')).toBeInTheDocument();
    expect(screen.getByText('5 Nos. Needed')).toBeInTheDocument();
  });
});

describe('EmployeeStockCheck item card expand/collapse', () => {
  it('groups the expand caret beside quantity needed and exposes shortage status separately', async () => {
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{ ...item, startOfDay: { ...savedSod, available: 2, usable: 2 }, currentStock: 2 }]);

    render(<EmployeeStockCheck store={store} />);
    await screen.findByText('6 Nos. Needed');

    const itemCard = screen.getByText('Milk').closest('.employee-stock-check-page__item');
    const neededGroup = itemCard?.querySelector('.employee-stock-check-page__needed-group');
    expect(neededGroup?.querySelector('.employee-stock-check-page__collapse-toggle')).toBeInTheDocument();
    expect(itemCard?.querySelector('.employee-stock-check-page__status-badge')).toHaveTextContent('6 Nos. Needed');
  });

  it('keeps the Start of Day order lock but removes its banner message', async () => {
    const user = userEvent.setup();
    vi.mocked(nfToast.error).mockClear();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{ ...item, startOfDay: savedSod, startOfDayLocked: true }]);

    render(<EmployeeStockCheck store={store} />);
    await user.click(await screen.findByText('Milk'));
    const sodCard = screen.getByRole('region', { name: 'Start of Day Stock Check' });
    expect(screen.queryByText('An order has been placed based on the Start of Day count, so you cannot edit it.')).not.toBeInTheDocument();
    expect(within(sodCard).getByLabelText('Total Stock')).toBeDisabled();

    await user.click(within(sodCard).getByLabelText('Locked for today: an order or shortage report is based on this count'));
    expect(nfToast.error).toHaveBeenCalledWith('Locked for today: an order or shortage report is based on this count');
  });

  it('locks an End of Day count after its approval and shows the error toast on an edit attempt', async () => {
    const user = userEvent.setup();
    vi.mocked(nfToast.error).mockClear();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{
      ...item,
      startOfDay: savedSod,
      endOfDay: savedEod,
      endOfDayLocked: true,
    }]);

    render(<EmployeeStockCheck store={store} />);
    await user.click(await screen.findByText('Milk'));
    const eodCard = screen.getByRole('region', { name: 'End of Day Stock Check' });
    const reason = 'This End of Day count was approved by your admin and cannot be edited';
    expect(within(eodCard).getByLabelText('Total Stock')).toBeDisabled();
    expect(within(eodCard).queryByRole('button', { name: 'Update Count' })).not.toBeInTheDocument();

    await user.click(within(eodCard).getByLabelText(reason));
    expect(nfToast.error).toHaveBeenCalledWith(reason);
  });

  it('marks Sufficient as a status badge for the compact card layout', async () => {
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{ ...item, startOfDay: savedSod, currentStock: 8 }]);

    render(<EmployeeStockCheck store={store} />);
    await screen.findByText('Sufficient');

    const itemCard = screen.getByText('Milk').closest('.employee-stock-check-page__item');
    expect(itemCard?.querySelector('.employee-stock-check-page__status-badge')).toHaveTextContent('Sufficient');
    expect(itemCard?.querySelector('.employee-stock-check-page__collapse-toggle')).toBeInTheDocument();
  });

  it('keeps the card neutral when only the previous day count is available', async () => {
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{
      ...item,
      previousEndOfDay: {
        date: '2026-10-21',
        usable: 2,
        expectedStart: 2,
        submittedById: 1,
        submittedByName: 'Ananya',
        submittedAt: '2026-10-21T17:00:00Z',
        restockCovered: 0,
        lowerCovered: 0,
      },
    }]);

    render(<EmployeeStockCheck store={store} />);
    await screen.findByText('Milk');

    const card = screen.getByText('Milk').closest('.employee-stock-check-page__item');
    expect(card).not.toHaveClass('employee-stock-check-page__item--shortage');
    expect(card).not.toHaveClass('employee-stock-check-page__item--optimal');
    expect(card?.querySelector('.employee-stock-check-page__status-badge')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shortage (0)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sufficient (0)' })).toBeInTheDocument();
  });

  it('expands and collapses when the header row itself is clicked, not just the chevron', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([item]);

    render(<EmployeeStockCheck store={store} />);
    await screen.findByText('Milk');
    expect(screen.getByText('Qty Needed = Min Target − Available')).toBeInTheDocument();
    const itemCard = screen.getByText('Milk').closest('.employee-stock-check-page__item');
    const neededGroup = itemCard?.querySelector('.employee-stock-check-page__needed-group');
    expect(neededGroup?.contains(itemCard?.querySelector('.employee-stock-check-page__collapse-toggle') ?? null)).toBe(true);

    // Pending status (no counts yet) starts collapsed.
    expect(screen.queryByText('Shift Stock Reconciliations')).not.toBeInTheDocument();

    // Click the item name -- not the chevron -- and it should still expand.
    await user.click(screen.getByText('Milk'));
    await waitFor(() => expect(screen.getByText('Shift Stock Reconciliations')).toBeInTheDocument());

    // Click empty space on the header (the target text) to collapse again.
    await user.click(screen.getByText(/Today's target/));
    await waitFor(() => expect(screen.queryByText('Shift Stock Reconciliations')).not.toBeInTheDocument());
  });
});

describe('EmployeeStockCheck End of Day gating', () => {
  it('disables End of Day until Start of Day has been saved for that item', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([item]);

    render(<EmployeeStockCheck store={store} />);
    await user.click(await screen.findByText('Milk'));
    await screen.findByText('Shift Stock Reconciliations');

    const eodCard = screen.getByRole('region', { name: 'End of Day Stock Check' });
    expect(within(eodCard).getByText('Submit the Start of Day count first')).toBeInTheDocument();
    expect(within(eodCard).queryByRole('button', { name: 'Save Check' })).not.toBeInTheDocument();

    const sodCard = screen.getByRole('region', { name: 'Start of Day Stock Check' });
    expect(within(sodCard).getByRole('button', { name: 'Save Check' })).toBeEnabled();
  });

  it('refuses an End of Day total above Start of Day even when the extra is entered as dead stock', async () => {
    const user = userEvent.setup();
    vi.mocked(nfToast.error).mockClear();
    vi.mocked(stockCheckApi.submitStockCheck).mockClear();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    const sod = { ...savedSod, available: 11, usable: 11 };
    mockGetTodayStockCheck.mockResolvedValue([{ ...item, startOfDay: sod, currentStock: 11, openOrders: [] }]);

    render(<EmployeeStockCheck store={store} />);
    await user.click(await screen.findByText('Milk'));
    const eodCard = screen.getByRole('region', { name: 'End of Day Stock Check' });
    const total = within(eodCard).getByLabelText('Total Stock');
    const dead = within(eodCard).getByLabelText('Dead / Spoilage');
    await user.clear(total);
    await user.type(total, '12');
    await user.clear(dead);
    await user.type(dead, '2');
    await user.click(within(eodCard).getByRole('button', { name: 'Save Check' }));

    await waitFor(() => expect(nfToast.error).toHaveBeenCalledWith(
      'End of Day cannot be greater than Start of Day plus the stock received.',
    ));
    expect(stockCheckApi.submitStockCheck).not.toHaveBeenCalled();
  });
});

describe('EmployeeStockCheck pending-approval lock', () => {
  const savedSod = {
    available: 15, deadStock: 0, usable: 15, enteredById: 1, enteredByName: 'Ananya', enteredAt: '2026-10-19T09:00:00Z',
    lastUpdatedByName: 'Ananya', lastUpdatedByAvatarUrl: null, lastUpdatedAt: '2026-10-19T09:00:00Z', edited: false,
  };

  async function expand(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText('Milk');
    await user.click(screen.getByText('Milk'));
    await waitFor(() => expect(screen.getByText('Shift Stock Reconciliations')).toBeInTheDocument());
  }

  it('locks Start of Day and shows the waiting banner while a request is pending', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{
      ...item,
      startOfDay: savedSod,
      startOfDayReview: { type: 'LOWER_COUNT', status: 'PENDING', quantity: 5, reason: 'Spilled overnight' },
    }]);

    render(<EmployeeStockCheck store={store} />);
    await expand(user);

    expect(screen.getByText('Start of Day is lower than the last End of Day. Waiting for your admin to approve.')).toBeInTheDocument();
    const sodCard = screen.getByRole('region', { name: 'Start of Day Stock Check' });
    expect(within(sodCard).queryByRole('button', { name: 'Save Check' })).not.toBeInTheDocument();
    expect(within(sodCard).getByText('Waiting for your admin to approve this Start of Day request')).toBeInTheDocument();
  });

  it('locks End of Day and shows the waiting banner while a request is pending', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{
      ...item,
      startOfDay: savedSod,
      endOfDayReview: { type: 'RESTOCK', status: 'PENDING', quantity: 15, reason: null },
    }]);

    render(<EmployeeStockCheck store={store} />);
    await expand(user);

    expect(screen.getByText('Restock reported with End of Day. Waiting for your admin to approve.')).toBeInTheDocument();
    const eodCard = screen.getByRole('region', { name: 'End of Day Stock Check' });
    expect(within(eodCard).queryByRole('button', { name: 'Save Check' })).not.toBeInTheDocument();
    expect(within(eodCard).getByText('Waiting for your admin to approve this End of Day request')).toBeInTheDocument();
  });

  it('shows the rejected banner and re-enables the card once rejected', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([{
      ...item,
      startOfDay: savedSod,
      endOfDayReview: { type: 'RESTOCK', status: 'REJECTED', quantity: 15, reason: null },
    }]);

    render(<EmployeeStockCheck store={store} />);
    await expand(user);

    expect(screen.getByText('Your admin rejected the End of Day request. Please recount and save End of Day again.')).toBeInTheDocument();
    const eodCard = screen.getByRole('region', { name: 'End of Day Stock Check' });
    expect(within(eodCard).getByRole('button', { name: 'Save Check' })).toBeEnabled();
  });
});

describe('EmployeeStockCheck status filters', () => {
  it('matches Stock Check History status options and separates shortages from sufficient or uncounted items', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([
      { ...item, storeInventoryItemId: 1, itemName: 'Milk', startOfDay: { ...savedSod, available: 2, usable: 2 }, currentStock: 2 },
      { ...item, storeInventoryItemId: 2, itemName: 'Sugar', startOfDay: savedSod, currentStock: 8 },
      { ...item, storeInventoryItemId: 3, itemName: 'Flour', currentStock: null },
    ]);

    render(<EmployeeStockCheck store={store} />);

    await screen.findByText('Milk');
    expect(screen.getByRole('button', { name: 'All Records (3)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Shortage (1)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sufficient (1)' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Shortage (1)' }));
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Sugar')).not.toBeInTheDocument();
    expect(screen.queryByText('Flour')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sufficient (1)' }));
    expect(screen.getByText('Sugar')).toBeInTheDocument();
    expect(screen.queryByText('Flour')).not.toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
  });
});

describe('EmployeeStockCheck missing End of Day from yesterday', () => {
  const blocked: DailyStockCheckItem = { ...item, missedEndOfDay: { date: '2026-10-14' } };

  async function expandMilk(user: ReturnType<typeof userEvent.setup>) {
    await screen.findByText('Milk');
    await user.click(screen.getByText('Milk'));
    await waitFor(() => expect(screen.getByText('Shift Stock Reconciliations')).toBeInTheDocument());
  }

  it('flags the item on its card', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([blocked]);

    render(<EmployeeStockCheck store={store} />);
    await expandMilk(user);

    expect(screen.getByText(/Yesterday's End of Day is missing/)).toBeInTheDocument();
  });

  it('shows the popup instead of saving Start of Day, and its button opens the notifications', async () => {
    const user = userEvent.setup();
    const onOpenNotifications = vi.fn();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([blocked]);

    const { container } = render(<EmployeeStockCheck store={store} onOpenNotifications={onOpenNotifications} />);
    await expandMilk(user);

    await user.type(container.querySelector('#stock-1-sod-available') as HTMLInputElement, '5');
    await user.click(screen.getAllByRole('button', { name: 'Save Check' })[0]);

    expect(await screen.findByText("Yesterday's End of Day is missing")).toBeInTheDocument();
    expect(stockCheckApi.submitStockCheck).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Respond in notifications' }));
    expect(onOpenNotifications).toHaveBeenCalledTimes(1);
  });

  it('does not flag an item that has no missing End of Day', async () => {
    const user = userEvent.setup();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    mockGetTodayStockCheck.mockResolvedValue([item]);

    render(<EmployeeStockCheck store={store} />);
    await expandMilk(user);

    expect(screen.queryByText(/Yesterday's End of Day is missing/)).not.toBeInTheDocument();
  });
});

describe('EmployeeStockCheck refresh after save', () => {
  it('quietly re-reads the day after a Start of Day save so derived figures such as current stock are not stale', async () => {
    const user = userEvent.setup();
    mockGetTodayStockCheck.mockReset();
    vi.mocked(stockCheckApi.submitStockCheck).mockReset();
    mockGetMe.mockResolvedValue({ id: 1, name: 'Ananya', email: 'a@a.com', role: 'EMPLOYEE' } as never);
    const sod = { ...savedSod, available: 6, deadStock: 1, usable: 5 };
    mockGetTodayStockCheck
      .mockResolvedValueOnce([item])
      .mockResolvedValue([{ ...item, startOfDay: sod, currentStock: 5 }]);
    vi.mocked(stockCheckApi.submitStockCheck).mockResolvedValue({
      ...item, startOfDay: sod, endOfDay: null,
    } as never);

    render(<EmployeeStockCheck store={store} />);
    await user.click(await screen.findByText('Milk'));
    await screen.findByText('Shift Stock Reconciliations');
    expect(mockGetTodayStockCheck).toHaveBeenCalledTimes(1);

    const sodCard = screen.getByRole('region', { name: 'Start of Day Stock Check' });
    const total = within(sodCard).getByLabelText('Total Stock');
    const dead = within(sodCard).getByLabelText('Dead / Spoilage');
    await user.clear(total);
    await user.type(total, '6');
    await user.clear(dead);
    await user.type(dead, '1');
    await user.click(within(sodCard).getByRole('button', { name: 'Save Check' }));

    await waitFor(() => expect(stockCheckApi.submitStockCheck).toHaveBeenCalled());
    await waitFor(() => expect(mockGetTodayStockCheck).toHaveBeenCalledTimes(2));
  });
});
