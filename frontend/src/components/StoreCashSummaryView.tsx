import {
  Banknote, Calculator, CircleCheck, HandCoins, Landmark, Scale, TriangleAlert, Wallet,
} from 'lucide-react';
import type { StoreMonthlyCashSummary } from '../types/cashSummary';
import { formatCurrency } from '../utils/currency';
import StatCard from './StatCard';
import DailyCashBreakdownTable from './DailyCashBreakdownTable';
import './StoreCashSummaryView.css';

interface StoreCashSummaryViewProps {
  summary: StoreMonthlyCashSummary;
}

function formatVariance(value: number): string {
  if (value === 0) return formatCurrency(0);
  return value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);
}

// Red for a shortage, green for an overage; plain when it balances. The sign is
// always in the text too, so colour is never the only signal.
function signClass(value: number | null): string {
  if (value === null || value === 0) return '';
  return value < 0 ? ' cash-kpi--short' : ' cash-kpi--over';
}

function money(value: number | null): string {
  return value === null ? '—' : formatCurrency(value);
}

// Single-store Month-End Cash Summary: the month's cash flows as tiles, the
// closing position as a "Cash Reconciliation" group, then the per-day rows that
// explain both. Built from the shared StatCard so it reads like Employees,
// Stores and Inventory. Every figure is the API's; nothing is recalculated here.
function StoreCashSummaryView({ summary }: StoreCashSummaryViewProps) {
  const variance = summary.variance;
  const net = summary.netDailyVariance;

  return (
    <section className="card cash-view" aria-label="Month-end cash summary for the store">
      <div className="stat-card-row cash-view__flows">
        <StatCard icon={Banknote} label="Total Cash Sales" value={money(summary.totalCashSales)} tone="primary" />
        <StatCard icon={HandCoins} label="Total Cash Removed" value={money(summary.totalCashRemoved)} tone="success" />
        <StatCard icon={Landmark} label="Bank Deposits" value={money(summary.bankDeposits)} tone="warning" />
        <StatCard icon={Wallet} label="Cash Expenses" value={money(summary.cashExpenses)} tone="info" />
        <StatCard
          icon={Scale}
          label="Adjustments"
          value={summary.adjustments === null ? '—' : formatVariance(summary.adjustments)}
          tone="purple"
          className={signClass(summary.adjustments).trim()}
        />
      </div>

      <div className="cash-view__position" role="group" aria-label="Cash reconciliation">
        <div className="stat-card-row cash-view__position-row">
          <StatCard
            icon={CircleCheck}
            label="Expected Cash on Hand"
            value={money(summary.expectedCashOnHand)}
            caption="As at the last day recorded"
            tone="success"
          />
          <StatCard
            icon={Wallet}
            label="Actual Cash Count"
            value={money(summary.actualCashCount)}
            caption="Cash remaining on that day"
            tone="info"
          />
          <StatCard
            icon={TriangleAlert}
            label="Variance"
            value={variance === null ? '—' : formatVariance(variance)}
            caption="Actual − expected"
            tone="primary"
            className={signClass(variance).trim()}
          />
          <StatCard
            icon={Calculator}
            label="Net Daily Variance"
            value={net === null ? '—' : formatVariance(net)}
            caption="Every day’s over/short added up"
            tone="purple"
            className={signClass(net).trim()}
          />
        </div>
      </div>

      <DailyCashBreakdownTable summary={summary} />
    </section>
  );
}

export default StoreCashSummaryView;
