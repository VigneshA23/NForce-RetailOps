import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StoreBreakdownTable from './StoreBreakdownTable';
import type { StoreMonthlyCashSummary } from '../types/cashSummary';

function store(overrides: Partial<StoreMonthlyCashSummary> = {}): StoreMonthlyCashSummary {
  return {
    storeId: 1, storeName: 'Store 1', storeCode: 101, daysRecorded: 4, asOfDate: '2026-11-13',
    totalCashSales: 1070, totalCashRemoved: 172, bankDeposits: 422, cashExpenses: 281, adjustments: 1100,
    expectedCashOnHand: 1700, actualCashCount: 700, variance: -1000, netDailyVariance: -989,
    dailyBreakdown: [], ...overrides,
  };
}

describe('StoreBreakdownTable', () => {
  it('renders nothing when no store recorded cash', () => {
    const { container } = render(<StoreBreakdownTable stores={[]} combined={store({ storeId: null })} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists each store and shows the API’s Combined figures in the footer without summing', () => {
    // Combined deliberately differs from the sum of the rows: the table must show what the API said.
    render(<StoreBreakdownTable
      stores={[store(), store({ storeId: 2, storeName: 'Store 2', storeCode: 102, totalCashSales: 30 })]}
      combined={store({ storeId: null, storeName: 'Combined', storeCode: null, daysRecorded: 8, totalCashSales: 9999 })}
    />);

    const table = screen.getByRole('table', { name: 'Store cash breakdown' });
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(within(table).getByText('#101')).toBeInTheDocument();
    const footer = table.querySelector('tfoot tr') as HTMLElement;
    expect(within(footer).getByText('$9,999.00')).toBeInTheDocument();
    expect(within(footer).getByText('(2 stores)')).toBeInTheDocument();
  });
});
