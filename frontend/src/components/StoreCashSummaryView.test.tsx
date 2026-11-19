import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StoreCashSummaryView from './StoreCashSummaryView';
import type { StoreMonthlyCashSummary } from '../types/cashSummary';

function summary(overrides: Partial<StoreMonthlyCashSummary> = {}): StoreMonthlyCashSummary {
  return {
    storeId: 1, storeName: 'Store 1', storeCode: 101, daysRecorded: 1, asOfDate: '2026-11-12',
    totalCashRemoved: 84, totalCashRemaining: 10, adjustments: -17,
    expectedCashOnHand: 55,
    dailyBreakdown: [{
      businessDate: '2026-11-12', openingDrawerCash: 30, cashRemoved: 20, cashRemaining: 10,
      adjustments: -30, dailyExpected: -20, expectedCashOnHand: 55,
    }],
    ...overrides,
  };
}

describe('StoreCashSummaryView', () => {
  it('shows the tiles with the API totals', () => {
    render(<StoreCashSummaryView summary={summary()} />);
    for (const [label, value] of [
      ['Total Cash Removed', '$84.00'],
      ['Total Cash Remaining', '$10.00'],
      ['Adjustments', '-$17.00'],
      ['Expected Cash on Hand', '$55.00'],
    ]) {
      const tile = screen.getByText(label, { selector: '.stat-card__label' }).closest('.stat-card') as HTMLElement;
      expect(within(tile).getByText(value)).toBeInTheDocument();
    }
  });

  it('shows exactly four tiles and no variance or actual-count tile', () => {
    render(<StoreCashSummaryView summary={summary()} />);
    const tiles = document.querySelectorAll('.cash-view__tiles .stat-card');
    expect(tiles).toHaveLength(4);
    const labels = Array.from(tiles).map((t) => t.querySelector('.stat-card__label')?.textContent);
    expect(labels).toEqual(['Total Cash Removed', 'Total Cash Remaining', 'Adjustments', 'Expected Cash on Hand']);
    expect(screen.queryByText('Variance', { selector: '.stat-card__label' })).not.toBeInTheDocument();
    expect(screen.queryByText('Actual Cash Count', { selector: '.stat-card__label' })).not.toBeInTheDocument();
  });

  it('colours a negative adjustment red and a positive one green, always with the sign', () => {
    const { rerender } = render(<StoreCashSummaryView summary={summary()} />);
    expect(screen.getByText('Adjustments', { selector: '.stat-card__label' }).closest('.stat-card')).toHaveClass('cash-kpi--short');
    rerender(<StoreCashSummaryView summary={summary({ adjustments: 5 })} />);
    expect(screen.getByText('Adjustments', { selector: '.stat-card__label' }).closest('.stat-card')).toHaveClass('cash-kpi--over');
    expect(screen.getByText('+$5.00', { selector: '.stat-card__value' })).toBeInTheDocument();
  });

  it('includes the daily breakdown table', () => {
    render(<StoreCashSummaryView summary={summary()} />);
    expect(screen.getByRole('table', { name: 'Daily cash breakdown' })).toBeInTheDocument();
  });
});
