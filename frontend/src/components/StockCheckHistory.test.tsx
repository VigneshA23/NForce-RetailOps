import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StockCheckHistory from './StockCheckHistory';
import * as storeInventoryApi from '../api/storeInventory';
import type { StockCheckHistoryPage, StockCheckResponse } from '../types/stockCheck';

vi.mock('../api/storeInventory', () => ({
  getStockCheckHistory: vi.fn(),
}));

const mockGetStockCheckHistory = vi.mocked(storeInventoryApi.getStockCheckHistory);

function row(overrides: Partial<StockCheckResponse>): StockCheckResponse {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Paper Towels',
    checkDate: '2026-09-20',
    currentCount: 12,
    quantityNeeded: 0,
    checkedByName: 'Jane Doe',
    createdAt: '2026-09-20T09:00:00Z',
    corrected: false,
    originalCurrentCount: null,
    correctedByName: null,
    correctedAt: null,
    ...overrides,
  };
}

function page(overrides: Partial<StockCheckHistoryPage>): StockCheckHistoryPage {
  return {
    items: [],
    page: 1,
    pageSize: 50,
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

  it('shows both the corrected value and the original value/corrector for a corrected row', async () => {
    mockGetStockCheckHistory.mockResolvedValue(page({
      items: [row({ currentCount: 6, corrected: true, originalCurrentCount: 10, correctedByName: 'Owner Olivia' })],
      totalItems: 1,
    }));

    render(<StockCheckHistory />);

    const tableRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    expect(within(tableRow).getByText('6')).toBeInTheDocument();
    expect(within(tableRow).getByText(/corrected from 10 by Owner Olivia/)).toBeInTheDocument();
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
