import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MonthlyCashSummary from './MonthlyCashSummary';
import * as cashSummaryApi from '../api/cashSummary';
import * as superAdminStoresApi from '../api/superAdminStores';
import type { MonthlyCashSummary as Summary, StoreMonthlyCashSummary } from '../types/cashSummary';
import type { SuperAdminStore } from '../types/superAdminStore';

vi.mock('../api/cashSummary', () => ({
  getMonthlyCashSummary: vi.fn(),
  getSuperAdminMonthlyCashSummary: vi.fn(),
}));
vi.mock('../api/superAdminStores', () => ({ getAllStores: vi.fn() }));

function store(storeId: number, storeName: string): SuperAdminStore {
  return {
    storeId, storeName, storeCode: 100 + storeId, storeLocation: null, storeActive: false,
    ownerId: null, ownerName: null, ownerAccessActive: false, ownerActive: null, employeeCount: 0, taskCount: 0, cashTarget: null,
  };
}

function column(overrides: Partial<StoreMonthlyCashSummary>): StoreMonthlyCashSummary {
  return {
    storeId: 1,
    storeName: 'Store 1',
    storeCode: 101,
    daysRecorded: 30,
    asOfDate: '2026-10-31',
    totalCashRemoved: 300,
    adjustments: -10,
    expectedCashOnHand: 320,
    totalCashRemaining: 325,
    dailyBreakdown: [],
    ...overrides,
  };
}

function summary(stores: StoreMonthlyCashSummary[], combined: StoreMonthlyCashSummary): Summary {
  return { month: '2026-11', periodStart: '2026-11-01', periodEnd: '2026-11-10', stores, combined };
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

beforeEach(() => {
  vi.mocked(cashSummaryApi.getMonthlyCashSummary).mockReset();
  vi.mocked(cashSummaryApi.getSuperAdminMonthlyCashSummary).mockReset();
  vi.mocked(superAdminStoresApi.getAllStores).mockReset().mockResolvedValue([
    store(1, 'Store 1'),
    store(2, 'Store 2'),
  ]);
});

const DAYS = [{
  businessDate: '2026-10-31', openingDrawerCash: 150, cashRemoved: 200,
  cashRemaining: 325, adjustments: -10, dailyExpected: 315, expectedCashOnHand: 320,
}];

function emptyColumn(overrides: Partial<StoreMonthlyCashSummary> = {}): StoreMonthlyCashSummary {
  return column({
    daysRecorded: 0, asOfDate: null, totalCashRemoved: null,
    adjustments: null, expectedCashOnHand: null, totalCashRemaining: null,
    dailyBreakdown: [], ...overrides,
  });
}

// The store selector is a button (no visible label, like the Daily Checklist's).
async function openStoreSelect(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(document.getElementById('cash-summary-store')).toBeEnabled());
  await user.click(document.getElementById('cash-summary-store') as HTMLElement);
}

function tile(label: string): HTMLElement {
  return screen.getByText(label, { selector: '.stat-card__label' }).closest('.stat-card') as HTMLElement;
}

describe('MonthlyCashSummary', () => {
  it('defaults Super Admin to All Stores and fetches the combined month straight away', async () => {
    vi.mocked(cashSummaryApi.getSuperAdminMonthlyCashSummary).mockResolvedValue(summary(
      [column({})],
      column({ storeId: null, storeName: 'Combined', storeCode: null, expectedCashOnHand: 640 }),
    ));

    render(<MonthlyCashSummary scope="super-admin" />);

    expect(await screen.findByRole('table', { name: 'Store cash breakdown' })).toBeInTheDocument();
    expect(within(tile('Expected Cash on Hand')).getByText('$640.00')).toBeInTheDocument();
    expect(cashSummaryApi.getSuperAdminMonthlyCashSummary).toHaveBeenCalledWith(currentMonth(), expect.anything(), undefined);
  });

  it('shows the tiles layout with a store breakdown when Super Admin selects all stores', async () => {
    vi.mocked(cashSummaryApi.getSuperAdminMonthlyCashSummary).mockResolvedValue(summary(
      [column({}), column({ storeId: 2, storeName: 'Store 2', expectedCashOnHand: 20 })],
      column({ storeId: null, storeName: 'Combined', storeCode: null, expectedCashOnHand: 640 }),
    ));

    render(<MonthlyCashSummary scope="super-admin" />);

    expect(await screen.findByRole('table', { name: 'Store cash breakdown' })).toBeInTheDocument();
    expect(within(tile('Expected Cash on Hand')).getByText('$640.00')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Store cash breakdown' });
    expect(within(table).getByText('Store 1')).toBeInTheDocument();
    expect(within(table).getByText('Store 2')).toBeInTheDocument();
    // The footer is the API's Combined row.
    const footer = table.querySelector('tfoot tr') as HTMLElement;
    expect(within(footer).getByText('Combined')).toBeInTheDocument();
    expect(within(footer).getAllByText('$640.00').length).toBeGreaterThan(0);
    expect(screen.queryByRole('table', { name: 'Daily cash breakdown' })).not.toBeInTheDocument();
    expect(cashSummaryApi.getSuperAdminMonthlyCashSummary).toHaveBeenCalledWith(currentMonth(), expect.anything(), undefined);
  });

  it('switches between All Stores and one store, always in the same layout', async () => {
    const user = userEvent.setup();
    vi.mocked(cashSummaryApi.getSuperAdminMonthlyCashSummary)
      .mockResolvedValueOnce(summary(
        [column({}), column({ storeId: 2, storeName: 'Store 2', expectedCashOnHand: 20 })],
        column({ storeId: null, storeName: 'Combined', storeCode: null, expectedCashOnHand: 640 }),
      ))
      .mockResolvedValueOnce(summary(
        [column({ storeId: 2, storeName: 'Store 2', expectedCashOnHand: 20, dailyBreakdown: DAYS })],
        column({ storeId: null, storeName: 'Combined', storeCode: null }),
      ))
      .mockResolvedValueOnce(summary(
        [column({}), column({ storeId: 2, storeName: 'Store 2', expectedCashOnHand: 20 })],
        column({ storeId: null, storeName: 'Combined', storeCode: null, expectedCashOnHand: 640 }),
      ));

    render(<MonthlyCashSummary scope="super-admin" />);
    await screen.findByRole('table', { name: 'Store cash breakdown' });
    await openStoreSelect(user);
    await user.type(screen.getByPlaceholderText('Search...'), 'Store 2');
    await user.click(screen.getByRole('button', { name: /Store 2.*#102/ }));

    expect(await screen.findByRole('table', { name: 'Daily cash breakdown' })).toBeInTheDocument();
    expect(within(tile('Expected Cash on Hand')).getByText('$20.00')).toBeInTheDocument();
    expect(cashSummaryApi.getSuperAdminMonthlyCashSummary).toHaveBeenLastCalledWith(currentMonth(), expect.anything(), 2);

    await openStoreSelect(user);
    await user.click((() => { const all = screen.getAllByRole('button', { name: 'All Stores' }); return all[all.length - 1]; })());
    expect(await screen.findByRole('table', { name: 'Store cash breakdown' })).toBeInTheDocument();
    expect(within(tile('Expected Cash on Hand')).getByText('$640.00')).toBeInTheDocument();
    expect(cashSummaryApi.getSuperAdminMonthlyCashSummary).toHaveBeenLastCalledWith(currentMonth(), expect.anything(), undefined);
  });

  it('lists only the stores that recorded cash in the Store Breakdown', async () => {
    vi.mocked(cashSummaryApi.getSuperAdminMonthlyCashSummary).mockResolvedValue(summary(
      [column({}), emptyColumn({ storeId: 2, storeName: 'Quiet Store' })],
      column({ storeId: null, storeName: 'Combined', storeCode: null }),
    ));

    render(<MonthlyCashSummary scope="super-admin" />);

    const table = await screen.findByRole('table', { name: 'Store cash breakdown' });
    expect(within(table).getByText('Store 1')).toBeInTheDocument();
    expect(within(table).queryByText('Quiet Store')).not.toBeInTheDocument();
  });

  it('shows the owner’s own store with its daily breakdown', async () => {
    vi.mocked(cashSummaryApi.getMonthlyCashSummary).mockResolvedValue(summary(
      [column({ dailyBreakdown: DAYS })],
      column({ storeId: null, storeName: 'Combined', storeCode: null }),
    ));

    render(<MonthlyCashSummary />);

    expect(await screen.findByRole('table', { name: 'Daily cash breakdown' })).toBeInTheDocument();
    expect(within(tile('Total Cash Removed')).getByText('$300.00')).toBeInTheDocument();
    expect(document.getElementById('cash-summary-store')).toBeNull();
  });

  it('keeps the same layout, with dashes not $0.00, when a store recorded nothing', async () => {
    vi.mocked(cashSummaryApi.getMonthlyCashSummary).mockResolvedValue(summary(
      [emptyColumn()],
      column({ storeId: null, storeName: 'Combined', daysRecorded: 0 }),
    ));

    render(<MonthlyCashSummary />);

    expect(await screen.findByText(/No daily cash entries were recorded/)).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBe(4);
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('keeps the same layout for All Stores in a month with no entries', async () => {
    vi.mocked(cashSummaryApi.getSuperAdminMonthlyCashSummary).mockResolvedValue(summary(
      [emptyColumn()],
      emptyColumn({ storeId: null, storeName: 'Combined', storeCode: null }),
    ));

    render(<MonthlyCashSummary scope="super-admin" />);

    expect(await screen.findByText(/No daily cash entries were recorded/)).toBeInTheDocument();
    expect(screen.getAllByText('-').length).toBe(4);
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('steps back a month and cannot go past the current month', async () => {
    vi.mocked(cashSummaryApi.getMonthlyCashSummary).mockResolvedValue(summary([column({})], column({ storeId: null })));
    render(<MonthlyCashSummary />);
    await screen.findByText('Total Cash Removed');

    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Previous month' }));

    const [y, m] = currentMonth().split('-').map(Number);
    const prev = new Date(y, m - 2, 1);
    const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`;
    expect(cashSummaryApi.getMonthlyCashSummary).toHaveBeenLastCalledWith(prevKey, expect.anything());
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled();
  });

  it('offers a retry when loading fails', async () => {
    vi.mocked(cashSummaryApi.getMonthlyCashSummary)
      .mockRejectedValueOnce(new Error('Server unavailable'))
      .mockResolvedValueOnce(summary([column({ dailyBreakdown: DAYS })], column({ storeId: null })));

    render(<MonthlyCashSummary />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table', { name: 'Daily cash breakdown' })).toBeInTheDocument();
  });
});
