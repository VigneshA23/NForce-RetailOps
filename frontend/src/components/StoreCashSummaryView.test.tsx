import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StoreCashSummaryView from './StoreCashSummaryView';
import type { StoreMonthlyCashSummary } from '../types/cashSummary';

function summary(overrides: Partial<StoreMonthlyCashSummary> = {}): StoreMonthlyCashSummary {
  return {
    storeId: 1, storeName: 'Store 1', storeCode: 101, daysRecorded: 1, asOfDate: '2026-11-12',
    totalCashRemoved: 84, cashExpenses: 9, adjustments: -17,
    expectedCashOnHand: 55, actualCashCount: 10, variance: -45, netDailyVariance: -3085,
    dailyBreakdown: [{
      businessDate: '2026-11-12', openingDrawerCash: 30, cashRemoved: 20,
      cashExpenses: 5, adjustments: -30, expectedCash: 55, cashRemaining: 10, variance: -45,
    }],
    ...overrides,
  };
}

describe('StoreCashSummaryView', () => {
  it('shows the flow tiles with the API totals', () => {
    render(<StoreCashSummaryView summary={summary()} />);
    for (const [label, value] of [
      ['Total Cash Removed', '$84.00'],
      ['Cash Expenses', '$9.00'], ['Adjustments', '-$17.00'],
    ]) {
      const tile = screen.getByText(label, { selector: '.stat-card__label' }).closest('.stat-card') as HTMLElement;
      expect(within(tile).getByText(value)).toBeInTheDocument();
    }
  });

  it('shows six tiles, three per row, with the closing figures explained and no Net Daily Variance tile', () => {
    render(<StoreCashSummaryView summary={summary()} />);
    const tiles = document.querySelectorAll('.cash-view__tiles .stat-card');
    expect(tiles).toHaveLength(6);
    const labels = Array.from(tiles).map((t) => t.querySelector('.stat-card__label')?.textContent);
    expect(labels).toEqual([
      'Total Cash Removed', 'Cash Expenses',
      'Adjustments', 'Expected Cash on Hand', 'Actual Cash Count', 'Variance',
    ]);
    expect(screen.queryByText('Net Daily Variance', { selector: '.stat-card__label' })).not.toBeInTheDocument();
    expect(screen.getByText('$55.00', { selector: '.stat-card__value' })).toBeInTheDocument();
    expect(screen.getByText('$10.00', { selector: '.stat-card__value' })).toBeInTheDocument();
    expect(screen.getByText('-$45.00', { selector: '.stat-card__value' })).toBeInTheDocument();
  });

  it('flags a shortage in red and an overage in green, always with the sign', () => {
    const { rerender } = render(<StoreCashSummaryView summary={summary()} />);
    expect(screen.getByText('Variance', { selector: '.stat-card__label' }).closest('.stat-card')).toHaveClass('cash-kpi--short');
    rerender(<StoreCashSummaryView summary={summary({ variance: 5, netDailyVariance: 0 })} />);
    expect(screen.getByText('Variance', { selector: '.stat-card__label' }).closest('.stat-card')).toHaveClass('cash-kpi--over');
    expect(screen.getByText('+$5.00', { selector: '.stat-card__value' })).toBeInTheDocument();
  });

  it('includes the daily breakdown table', () => {
    render(<StoreCashSummaryView summary={summary()} />);
    expect(screen.getByRole('table', { name: 'Daily cash breakdown' })).toBeInTheDocument();
  });
});
