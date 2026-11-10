import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import MonthlyCashSummary from './MonthlyCashSummary';
import * as cashSummaryApi from '../api/cashSummary';
import type { MonthlyCashSummary as Summary, StoreMonthlyCashSummary } from '../types/cashSummary';

vi.mock('../api/cashSummary', () => ({
  getMonthlyCashSummary: vi.fn(),
  getSuperAdminMonthlyCashSummary: vi.fn(),
}));

function column(overrides: Partial<StoreMonthlyCashSummary>): StoreMonthlyCashSummary {
  return {
    storeId: 1,
    storeName: 'Store 1',
    storeCode: 101,
    daysRecorded: 30,
    asOfDate: '2026-10-31',
    totalCashSales: 1800,
    totalCashRemoved: 300,
    bankDeposits: 900,
    cashExpenses: 70,
    adjustments: -10,
    expectedCashOnHand: 320,
    actualCashCount: 325,
    variance: 5,
    netDailyVariance: -5,
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
});

describe('MonthlyCashSummary', () => {
  it('shows Store 1, Store 2 and Combined columns for Super Admin', async () => {
    vi.mocked(cashSummaryApi.getSuperAdminMonthlyCashSummary).mockResolvedValue(summary(
      [column({}), column({ storeId: 2, storeName: 'Store 2', variance: -20 })],
      column({ storeId: null, storeName: 'Combined', storeCode: null, variance: -15, expectedCashOnHand: 640 }),
    ));

    render(<MonthlyCashSummary scope="super-admin" />);

    const table = await screen.findByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent ?? '');
    expect(headers.some((h) => h.startsWith('Store 1'))).toBe(true);
    expect(headers.some((h) => h.startsWith('Store 2'))).toBe(true);
    expect(headers.some((h) => h.startsWith('Combined'))).toBe(true);

    for (const label of ['Total cash sales', 'Total cash removed', 'Bank deposits', 'Cash expenses',
      'Adjustments', 'Expected cash on hand', 'Actual cash count', 'Variance']) {
      expect(within(table).getByRole('rowheader', { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    }
    const varianceRow = within(table).getByRole('rowheader', { name: /^Variance/ }).closest('tr')!;
    expect(within(varianceRow).getByText('+$5.00')).toBeInTheDocument();
    expect(within(varianceRow).getByText('-$20.00')).toBeInTheDocument();
    expect(within(varianceRow).getByText('-$15.00')).toBeInTheDocument();
    expect(within(table).getByText('$640.00')).toBeInTheDocument();
    expect(cashSummaryApi.getSuperAdminMonthlyCashSummary).toHaveBeenCalledWith(currentMonth(), expect.anything());
  });

  it('shows only the owner’s own store, without a Combined column', async () => {
    vi.mocked(cashSummaryApi.getMonthlyCashSummary).mockResolvedValue(summary(
      [column({})],
      column({ storeId: null, storeName: 'Combined', storeCode: null }),
    ));

    render(<MonthlyCashSummary />);

    const table = await screen.findByRole('table');
    expect(within(table).queryByText('Combined')).not.toBeInTheDocument();
    expect(within(table).getByText('$1,800.00')).toBeInTheDocument();
  });

  it('shows a dash, not $0.00, for a store with no entries', async () => {
    vi.mocked(cashSummaryApi.getMonthlyCashSummary).mockResolvedValue(summary(
      [column({
        daysRecorded: 0, asOfDate: null, totalCashSales: null, totalCashRemoved: null, bankDeposits: null,
        cashExpenses: null, adjustments: null, expectedCashOnHand: null, actualCashCount: null,
        variance: null, netDailyVariance: null,
      })],
      column({ storeId: null, storeName: 'Combined', daysRecorded: 0 }),
    ));

    render(<MonthlyCashSummary />);

    expect(await screen.findByText(/No daily cash entries were recorded/)).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBe(9);
    expect(screen.queryByText('$0.00')).not.toBeInTheDocument();
  });

  it('steps back a month and cannot go past the current month', async () => {
    vi.mocked(cashSummaryApi.getMonthlyCashSummary).mockResolvedValue(summary([column({})], column({ storeId: null })));
    render(<MonthlyCashSummary />);
    await screen.findByRole('table');

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
      .mockResolvedValueOnce(summary([column({})], column({ storeId: null })));

    render(<MonthlyCashSummary />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Server unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });
});
