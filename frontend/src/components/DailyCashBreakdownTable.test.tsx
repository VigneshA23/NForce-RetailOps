import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DailyCashBreakdownTable from './DailyCashBreakdownTable';
import type { DailyCashBreakdown, StoreMonthlyCashSummary } from '../types/cashSummary';

function day(businessDate: string, overrides: Partial<DailyCashBreakdown> = {}): DailyCashBreakdown {
  return {
    businessDate, openingDrawerCash: 100, totalCashSales: 1000, cashRemoved: 0, bankDeposits: 900,
    cashExpenses: 12, adjustments: 0, expectedCash: 190, cashRemaining: 190, variance: 0, ...overrides,
  };
}

function summary(days: DailyCashBreakdown[], overrides: Partial<StoreMonthlyCashSummary> = {}): StoreMonthlyCashSummary {
  return {
    storeId: 1, storeName: 'Store 1', storeCode: 101, daysRecorded: days.length,
    asOfDate: days.length ? days[days.length - 1].businessDate : null,
    totalCashSales: 3412, totalCashRemoved: 0, bankDeposits: 2700, cashExpenses: 30, adjustments: 0,
    expectedCashOnHand: 55, actualCashCount: 10, variance: -45, netDailyVariance: -45,
    dailyBreakdown: days, ...overrides,
  };
}

describe('DailyCashBreakdownTable', () => {
  it('renders nothing when there are no recorded days', () => {
    const { container } = render(<DailyCashBreakdownTable summary={summary([])} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lists only the recorded days, with no zero rows for missing days', () => {
    render(<DailyCashBreakdownTable summary={summary([day('2026-11-03'), day('2026-11-12')])} />);
    const table = screen.getByRole('table', { name: 'Daily cash breakdown' });
    const body = table.querySelectorAll('tbody tr');
    expect(body).toHaveLength(2);
  });

  it('marks the last day as the source of the closing figures and states it on screen', () => {
    render(<DailyCashBreakdownTable summary={summary([
      day('2026-11-03'),
      day('2026-11-12', { expectedCash: 55, cashRemaining: 10, variance: -45 }),
    ])} />);

    const table = screen.getByRole('table', { name: 'Daily cash breakdown' });
    const closing = table.querySelector('tbody tr[aria-current="true"]') as HTMLElement;
    expect(closing).not.toBeNull();
    expect(within(closing).getByText('Closing day')).toBeInTheDocument();
    expect(within(closing).getByText('$55.00')).toBeInTheDocument();
    expect(within(closing).getByText('$10.00')).toBeInTheDocument();
    expect(within(closing).getByText('-$45.00')).toBeInTheDocument();
    // The lead text names the same date.
    expect(screen.getByText(/the last recorded day/)).toBeInTheDocument();
    expect(screen.getByText(/12/, { selector: 'strong' })).toBeInTheDocument();
  });

  it('shows the API totals in the month-total row without recalculating them', () => {
    // Totals deliberately do not equal the sum of the rows: the component must
    // show what the API said, proving there is no client-side arithmetic.
    render(<DailyCashBreakdownTable summary={summary([day('2026-11-03')], {
      totalCashSales: 9999, netDailyVariance: 7,
    })} />);

    const footer = screen.getByRole('table', { name: 'Daily cash breakdown' }).querySelector('tfoot tr') as HTMLElement;
    expect(within(footer).getByText('$9,999.00')).toBeInTheDocument();
    expect(within(footer).getByText('+$7.00')).toBeInTheDocument();
    expect(within(footer).getByText('(1 day)')).toBeInTheDocument();
  });
});
