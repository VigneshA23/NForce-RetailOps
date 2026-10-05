import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StockCheckHistory from './StockCheckHistory';
import * as storeInventoryApi from '../api/storeInventory';
import type { StockCheckHistoryPage, StockCheckResponse, StockSnapshot } from '../types/stockCheck';

vi.mock('../api/storeInventory', () => ({
  getStockCheckHistory: vi.fn(),
}));

const mockGetStockCheckHistory = vi.mocked(storeInventoryApi.getStockCheckHistory);

function snapshot(overrides: Partial<StockSnapshot>): StockSnapshot {
  return {
    available: 12,
    deadStock: 0,
    usable: 12,
    enteredByName: 'Jane Doe',
    enteredAt: '2026-09-20T09:00:00Z',
    lastUpdatedByName: 'Jane Doe',
    lastUpdatedAt: '2026-09-20T09:00:00Z',
    edited: false,
    ...overrides,
  };
}

function row(overrides: Partial<StockCheckResponse>): StockCheckResponse {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Paper Towels',
    categoryId: 1,
    categoryName: 'Supplies',
    unitOfMeasurement: 'EA',
    checkDate: '2026-09-20',
    requiredPar: null,
    startOfDay: snapshot({}),
    endOfDay: null,
    stockUsed: null,
    requiredTomorrow: null,
    quantityToOrder: null,
    edits: [],
    ...overrides,
  };
}

function page(overrides: Partial<StockCheckHistoryPage>): StockCheckHistoryPage {
  return {
    items: [],
    page: 1,
    pageSize: 10,
    pageCount: 1,
    totalItems: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetStockCheckHistory.mockReset();
});

describe('StockCheckHistory', () => {
  it('renders an explicit empty state, not a blank table, for an empty range result', async () => {
    mockGetStockCheckHistory.mockResolvedValue(page({}));

    render(<StockCheckHistory />);

    expect(await screen.findByText('No stock checks recorded for the selected range.')).toBeInTheDocument();
  });

  it('shows the counted amount, a Shortage badge, and who recorded it', async () => {
    mockGetStockCheckHistory.mockResolvedValue(page({
      items: [row({
        requiredPar: 20,
        endOfDay: snapshot({ available: 16, usable: 16, lastUpdatedByName: 'Owner Olivia' }),
      })],
      totalItems: 1,
    }));

    render(<StockCheckHistory />);

    const tableRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    expect(within(tableRow).getByText('16 EA')).toBeInTheDocument();
    expect(within(tableRow).getByText('+4 EA needed')).toBeInTheDocument();
    expect(within(tableRow).getByText('Owner Olivia')).toBeInTheDocument();
    expect(within(tableRow).getByText('Supplies')).toBeInTheDocument();
  });

  it('badges an exact-par count as Sufficient', async () => {
    mockGetStockCheckHistory.mockResolvedValue(page({
      items: [row({ requiredPar: 10, endOfDay: snapshot({ available: 10, usable: 10 }) })],
      totalItems: 1,
    }));

    render(<StockCheckHistory />);

    expect(await screen.findByText('0 (Sufficient)')).toBeInTheDocument();
  });

  it('falls back to the Start of Day count when End of Day was never taken, but still badges it Not Counted', async () => {
    mockGetStockCheckHistory.mockResolvedValue(page({ items: [row({})], totalItems: 1 }));

    render(<StockCheckHistory />);

    const tableRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    // Count Entered reflects whatever the employee actually entered that day
    // (Start of Day's 12, from the default row() fixture) -- it must not read
    // as uncounted just because End of Day hasn't happened yet.
    expect(within(tableRow).getByText('12 EA')).toBeInTheDocument();
    // The Qty Needed badge is still "Not Counted", since reconciliation
    // specifically needs the End of Day figure.
    expect(within(tableRow).getByText('— (Not Counted)')).toBeInTheDocument();
  });

  it('shows no count at all when neither snapshot has been taken', async () => {
    mockGetStockCheckHistory.mockResolvedValue(page({ items: [row({ startOfDay: null })], totalItems: 1 }));

    render(<StockCheckHistory />);

    const tableRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    const countCell = tableRow.querySelector('[data-label="Count Entered"]')!;
    expect(countCell).toHaveTextContent('—');
  });

  it('filters rows by search term against item name and recorded-by name', async () => {
    const user = userEvent.setup();
    mockGetStockCheckHistory.mockResolvedValue(page({
      items: [
        row({ id: 1, itemName: 'Paper Towels', endOfDay: snapshot({ lastUpdatedByName: 'Ananya Reddy' }) }),
        row({ id: 2, itemName: 'Whole Milk', endOfDay: snapshot({ lastUpdatedByName: 'Arjun Pillai' }) }),
      ],
      totalItems: 2,
    }));

    render(<StockCheckHistory />);
    await screen.findByText('Paper Towels');

    await user.type(screen.getByPlaceholderText('Search by item name or staff name...'), 'milk');

    expect(screen.queryByText('Paper Towels')).not.toBeInTheDocument();
    expect(screen.getByText('Whole Milk')).toBeInTheDocument();
  });

  it('filters rows by status chip', async () => {
    const user = userEvent.setup();
    mockGetStockCheckHistory.mockResolvedValue(page({
      items: [
        row({ id: 1, itemName: 'Short Item', requiredPar: 10, endOfDay: snapshot({ available: 2, usable: 2 }) }),
        row({ id: 2, itemName: 'Sufficient Item', requiredPar: 10, endOfDay: snapshot({ available: 10, usable: 10 }) }),
      ],
      totalItems: 2,
    }));

    render(<StockCheckHistory />);
    await screen.findByText('Short Item');

    await user.click(screen.getByRole('button', { name: 'Shortage' }));

    expect(screen.getByText('Short Item')).toBeInTheDocument();
    expect(screen.queryByText('Sufficient Item')).not.toBeInTheDocument();
  });

  it('clears search and status filters via the reset-filter button', async () => {
    const user = userEvent.setup();
    mockGetStockCheckHistory.mockResolvedValue(page({ items: [row({})], totalItems: 1 }));

    render(<StockCheckHistory />);
    await screen.findByText('Paper Towels');

    await user.type(screen.getByPlaceholderText('Search by item name or staff name...'), 'nonexistent');
    expect(screen.queryByText('Paper Towels')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('Paper Towels')).toBeInTheDocument();
  });

  it('rejects an inverted custom range with an inline error and never calls the API for it', async () => {
    const user = userEvent.setup();
    mockGetStockCheckHistory.mockResolvedValue(page({}));

    render(<StockCheckHistory />);
    await waitFor(() => expect(mockGetStockCheckHistory).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /all time/i }));
    const panel = await screen.findByRole('dialog', { name: 'Choose a date range' });
    await user.click(within(panel).getByLabelText('Custom range'));

    const fromContainer = within(panel).getByText('From').closest('.date-range-picker__input-label') as HTMLElement;
    await user.click(within(fromContainer).getByRole('button'));
    const fromCalendar = await screen.findByRole('dialog', { name: 'Choose a date' });
    await user.click(within(fromCalendar).getByRole('button', { name: '25' }));

    const toContainer = within(panel).getByText('To').closest('.date-range-picker__input-label') as HTMLElement;
    await user.click(within(toContainer).getByRole('button'));
    const toCalendar = await screen.findByRole('dialog', { name: 'Choose a date' });
    await user.click(within(toCalendar).getByRole('button', { name: '5' }));

    await user.click(within(panel).getByRole('button', { name: 'Apply' }));

    expect(within(panel).getByText('Start date must be on or before end date.')).toBeInTheDocument();
    // Only the initial mount fetch happened -- the invalid selection never
    // reached onChange, so no second request was ever made.
    expect(mockGetStockCheckHistory).toHaveBeenCalledTimes(1);
  });

  it('refetches, resetting to page 1, when the date range changes', async () => {
    const user = userEvent.setup();
    mockGetStockCheckHistory.mockResolvedValue(page({ items: [row({})], totalItems: 1 }));

    render(<StockCheckHistory />);
    await waitFor(() => expect(mockGetStockCheckHistory).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /all time/i }));
    const panel = await screen.findByRole('dialog', { name: 'Choose a date range' });
    await user.click(within(panel).getByLabelText('Last 7 days'));
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(mockGetStockCheckHistory).toHaveBeenCalledTimes(2));
    const secondCallArgs = mockGetStockCheckHistory.mock.calls[1];
    // [startDate, endDate, page, size] -- page must be 1 even though the
    // first call could have left it anywhere.
    expect(secondCallArgs[2]).toBe(1);
  });
});
