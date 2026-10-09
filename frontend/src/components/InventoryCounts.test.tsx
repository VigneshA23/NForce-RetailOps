import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InventoryCounts from './InventoryCounts';
import * as storeInventoryApi from '../api/storeInventory';
import type { InventoryCountRow, InventoryCountsPage } from '../types/storeInventory';

vi.mock('../api/storeInventory', () => ({
  getInventoryCounts: vi.fn(),
  getInventoryCountHistory: vi.fn(),
  correctStockCheck: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockGetInventoryCounts = vi.mocked(storeInventoryApi.getInventoryCounts);
const mockGetInventoryCountHistory = vi.mocked(storeInventoryApi.getInventoryCountHistory);
const mockCorrectStockCheck = vi.mocked(storeInventoryApi.correctStockCheck);

function row(overrides: Partial<InventoryCountRow>): InventoryCountRow {
  return {
    itemId: 1,
    name: 'Milk',
    category: 'DAIRY',
    unitOfMeasurement: 'L',
    currentStock: 30,
    minimum: 20,
    status: 'HEALTHY',
    lastUpdatedAt: '2026-09-24T15:30:00Z',
    lastUpdatedByName: 'Sarah',
    change: 6,
    changeFromDate: '2026-09-23',
    latestCheckId: 42,
    latestSnapshot: 'END_OF_DAY',
    latestAvailable: 30,
    latestDeadStock: 0,
    imageId: null,
    ...overrides,
  };
}

function page(overrides: Partial<InventoryCountsPage> = {}): InventoryCountsPage {
  return {
    rows: [row({})],
    page: 1,
    size: 10,
    totalPages: 1,
    totalElements: 1,
    allCount: 1,
    outCount: 0,
    lowCount: 0,
    staleCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetInventoryCounts.mockReset().mockResolvedValue(page());
  mockGetInventoryCountHistory.mockReset().mockResolvedValue([]);
  mockCorrectStockCheck.mockReset();
});

describe('InventoryCounts', () => {
  it('renders rows and KPI tile counts from the loaded page', async () => {
    mockGetInventoryCounts.mockResolvedValue(page({
      rows: [row({ name: 'Milk' })],
      allCount: 5,
      outCount: 1,
      lowCount: 2,
      staleCount: 1,
    }));

    render(<InventoryCounts />);

    expect(await screen.findByText('Milk')).toBeInTheDocument();
    expect(within(screen.getByText('All Items').closest('.stat-card')!).getByText('5')).toBeInTheDocument();
    expect(within(screen.getByText('Out of Stock').closest('.stat-card')!).getByText('1')).toBeInTheDocument();
    expect(within(screen.getByText('Below Minimum').closest('.stat-card')!).getByText('2')).toBeInTheDocument();
    expect(within(screen.getByText('Not Updated Today').closest('.stat-card')!).getByText('1')).toBeInTheDocument();
  });

  it('shows an em dash and "Never counted" for an item with no check yet', async () => {
    mockGetInventoryCounts.mockResolvedValue(page({
      rows: [row({ name: 'Flour', currentStock: null, lastUpdatedAt: null, lastUpdatedByName: null, latestCheckId: null, latestSnapshot: null, change: null })],
    }));

    render(<InventoryCounts />);

    expect(await screen.findByText('Flour')).toBeInTheDocument();
    expect(screen.getByText('Never counted')).toBeInTheDocument();
    const tableRow = screen.getByText('Flour').closest('tr')!;
    expect(within(tableRow).getByLabelText(/edit count for flour/i)).toBeDisabled();
  });

  it('re-fetches with the search term as the user types', async () => {
    const user = userEvent.setup();
    render(<InventoryCounts />);
    await screen.findByText('Milk');
    mockGetInventoryCounts.mockClear();

    await user.type(screen.getByPlaceholderText('Search inventory'), 'milk');

    await waitFor(() => expect(mockGetInventoryCounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: 'milk' }),
    ));
  });

  it('toggles a KPI tile as a level filter, re-fetching with that level', async () => {
    const user = userEvent.setup();
    render(<InventoryCounts />);
    await screen.findByText('Milk');
    mockGetInventoryCounts.mockClear();

    await user.click(screen.getByRole('button', { name: /out of stock/i }));
    await waitFor(() => expect(mockGetInventoryCounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: 'out' }),
    ));

    mockGetInventoryCounts.mockClear();
    await user.click(screen.getByRole('button', { name: /out of stock/i }));
    await waitFor(() => expect(mockGetInventoryCounts).toHaveBeenLastCalledWith(
      expect.objectContaining({ level: undefined }),
    ));
  });

  it('lazily loads and shows the count-history timeline when a row is expanded', async () => {
    const user = userEvent.setup();
    mockGetInventoryCountHistory.mockResolvedValue([
      { checkDate: '2026-09-24', count: 30, delta: 6, updatedByName: 'Sarah', updatedAt: '2026-09-24T20:00:00Z' },
      { checkDate: '2026-09-23', count: 24, delta: null, updatedByName: 'Sarah', updatedAt: '2026-09-23T20:00:00Z' },
    ]);
    render(<InventoryCounts />);
    await screen.findByText('Milk');

    expect(mockGetInventoryCountHistory).not.toHaveBeenCalled();
    await user.click(screen.getByLabelText(/show count history for milk/i));

    const historyTable = await screen.findByText('Updated by');
    expect(within(historyTable.closest('table')!).getByText('+6')).toBeInTheDocument();
    expect(mockGetInventoryCountHistory).toHaveBeenCalledWith(1);

    // Collapsing and re-expanding doesn't re-fetch -- it's cached.
    await user.click(screen.getByLabelText(/show count history for milk/i));
    await user.click(screen.getByLabelText(/show count history for milk/i));
    expect(mockGetInventoryCountHistory).toHaveBeenCalledTimes(1);
  });

  it('submits an edit as a correction against the latest check and reloads', async () => {
    const user = userEvent.setup();
    mockCorrectStockCheck.mockResolvedValue({} as never);
    render(<InventoryCounts />);
    await screen.findByText('Milk');
    mockGetInventoryCounts.mockClear();

    await user.click(screen.getByLabelText(/edit count for milk/i));
    expect(await screen.findByText('Edit count: Milk')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Save count' }));

    await waitFor(() => expect(mockCorrectStockCheck).toHaveBeenCalledWith(42, 'END_OF_DAY', 31, 0, 'Recount (count was wrong)'));
    await waitFor(() => expect(mockGetInventoryCounts).toHaveBeenCalled());
  });
});
