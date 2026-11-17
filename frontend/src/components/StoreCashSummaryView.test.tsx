import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StoreCashSummaryView from './StoreCashSummaryView';
import type { StoreMonthlyCashSummary } from '../types/cashSummary';

function summary(overrides: Partial<StoreMonthlyCashSummary> = {}): StoreMonthlyCashSummary {
  return {
    storeId: 1, storeName: 'Store 1', storeCode: 101, daysRecorded: 1, asOfDate: '2026-11-12',
    totalCashSales: 3412, totalCashRemoved: 84, bankDeposits: 133, cashExpenses: 9, adjustments: -17,
    expectedCashOnHand: 55, actualCashCount: 10, variance: -45, netDailyVariance: -3085,
    dailyBreakdown: [{
      businessDate: '2026-11-12', openingDrawerCash: 30, totalCashSales: 100, cashRemoved: 20, bankDeposits: 20,
      cashExpenses: 5, adjustments: -30, expectedCash: 55, cashRemaining: 10, variance: -45,
    }],
    ...overrides,
  };
}

describe('StoreCashSummaryView', () => {
  it('shows the five flow tiles with the API totals', () => {
    render(<StoreCashSummaryView summary={summary()} />);
    for (const [label, value] of [
      ['Total Cash Sales', '$3,412.00'], ['Total Cash Removed', '$84.00'], ['Bank Deposits', '$133.00'],
      ['Cash Expenses', '$9.00'], ['Adjustments', '-$17.00'],
    ]) {
      const tile = screen.getByText(label, { selector: '.stat-card__label' }).closest('.stat-card') as HTMLElement;
      expect(within(tile).getByText(value)).toBeInTheDocument();
    }
  });

  it('groups expected, actual, variance and net variance under Cash Reconciliation with explanations', () => {
    render(<StoreCashSummaryView summary={summary()} />);
    const group = screen.getByRole('group', { name: 'Cash reconciliation' });
    expect(within(group).getByText('$55.00')).toBeInTheDocument();
    expect(within(group).getByText('$10.00')).toBeInTheDocument();
    expect(within(group).getByText('-$45.00')).toBeInTheDocument();
    expect(within(group).getByText('-$3,085.00')).toBeInTheDocument();
    expect(within(group).getByText('As at the last day recorded')).toBeInTheDocument();
    expect(within(group).getByText('Cash remaining on that day')).toBeInTheDocument();
  });

  it('flags a shortage in red and an overage in green, always with the sign', () => {
    const { rerender } = render(<StoreCashSummaryView summary={summary()} />);
    expect(screen.getByText('Variance', { selector: '.stat-card__label' }).closest('.stat-card')).toHaveClass('cash-kpi--short');
    rerender(<StoreCashSummaryView summary={summary({ variance: 5, netDailyVariance: 0 })} />);
    expect(screen.getByText('Variance', { selector: '.stat-card__label' }).closest('.stat-card')).toHaveClass('cash-kpi--over');
    expect(screen.getByText('+$5.00', { selector: '.stat-card__value' })).toBeInTheDocument();
    expect(screen.getByText('Net Daily Variance', { selector: '.stat-card__label' }).closest('.stat-card')).not.toHaveClass('cash-kpi--short');
  });

  it('includes the daily breakdown table', () => {
    render(<StoreCashSummaryView summary={summary()} />);
    expect(screen.getByRole('table', { name: 'Daily cash breakdown' })).toBeInTheDocument();
  });
});
