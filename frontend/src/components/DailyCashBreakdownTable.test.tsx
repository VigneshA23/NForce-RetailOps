import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DailyCashBreakdownTable from './DailyCashBreakdownTable';
import type { DailyCashBreakdown, StoreMonthlyCashSummary } from '../types/cashSummary';

function day(businessDate: string, overrides: Partial<DailyCashBreakdown> = {}): DailyCashBreakdown {
  return {
    businessDate, openingDrawerCash: 100, cashRemoved: 0, cashRemaining: 190,
    adjustments: 0, dailyExpected: 190, expectedCashOnHand: 190, ...overrides,
  };
}

function summary(days: DailyCashBreakdown[], overrides: Partial<StoreMonthlyCashSummary> = {}): StoreMonthlyCashSummary {
  return {
    storeId: 1, storeName: 'Store 1', storeCode: 101, daysRecorded: days.length,
    asOfDate: days.length ? days[days.length - 1].businessDate : null,
    totalCashRemoved: 0, totalCashRemaining: 0, adjustments: 0,
    expectedCashOnHand: 55,
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

  it('shows cash removed and remaining as recorded figures and marks the closing day', () => {
    render(<DailyCashBreakdownTable summary={summary([
      day('2026-11-03'),
      day('2026-11-12', { cashRemoved: 20, cashRemaining: 10, adjustments: -3, dailyExpected: 7, expectedCashOnHand: 197 }),
    ])} />);

    const table = screen.getByRole('table', { name: 'Daily cash breakdown' });
    const headers = Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent);
    expect(headers).toEqual([
      'Date', 'Opening Drawer', 'Cash Removed', 'Cash Remaining', 'Adjustments', 'Day Expected', 'Expected Cash on Hand',
    ]);
    const closing = table.querySelector('tbody tr[aria-current="true"]') as HTMLElement;
    expect(closing).not.toBeNull();
    expect(within(closing).getByText('Closing day')).toBeInTheDocument();
    expect(within(closing).getByText('$20.00')).toBeInTheDocument();
    expect(within(closing).getByText('$10.00')).toBeInTheDocument();
    expect(within(closing).getByText('-$3.00')).toBeInTheDocument();
    expect(within(closing).getByText('$7.00')).toBeInTheDocument();
    expect(within(closing).getByText('$197.00')).toBeInTheDocument();
    expect(screen.getByText(/the last recorded day/)).toBeInTheDocument();
    expect(screen.getByText(/12/, { selector: 'strong' })).toBeInTheDocument();
  });

  it('shows a dash for a figure nobody entered', () => {
    render(<DailyCashBreakdownTable summary={summary([day('2026-11-03', { openingDrawerCash: null, cashRemoved: null })])} />);
    const row = screen.getByRole('table', { name: 'Daily cash breakdown' }).querySelector('tbody tr') as HTMLElement;
    expect(within(row).getAllByText('-')).toHaveLength(2);
  });

  it('shows the API totals in the month-total row without recalculating them', () => {
    // Totals deliberately do not equal the sum of the rows: the component must
    // show what the API said, proving there is no client-side arithmetic.
    render(<DailyCashBreakdownTable summary={summary([day('2026-11-03')], {
      adjustments: 9999, totalCashRemoved: 4321, totalCashRemaining: 777, expectedCashOnHand: 5555,
    })} />);

    const footer = screen.getByRole('table', { name: 'Daily cash breakdown' }).querySelector('tfoot tr') as HTMLElement;
    expect(within(footer).getByText('+$9,999.00')).toBeInTheDocument();
    expect(within(footer).getByText('$4,321.00')).toBeInTheDocument();
    expect(within(footer).getByText('$777.00')).toBeInTheDocument();
    expect(within(footer).getByText('$5,555.00')).toBeInTheDocument();
    expect(within(footer).getByText('(1 day)')).toBeInTheDocument();
  });
});
