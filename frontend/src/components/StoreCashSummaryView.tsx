import {
  Banknote, CircleCheck, HandCoins, Landmark, Scale, TriangleAlert, Wallet,
} from 'lucide-react';
import type { StoreMonthlyCashSummary } from '../types/cashSummary';
import { formatCurrency } from '../utils/currency';
import StatCard from './StatCard';
import DailyCashBreakdownTable from './DailyCashBreakdownTable';
import StoreBreakdownTable from './StoreBreakdownTable';
import './StoreCashSummaryView.css';

interface StoreCashSummaryViewProps {
  // One store's month, or the Combined summary (storeId null) for All Stores.
  summary: StoreMonthlyCashSummary;
  // All Stores only: the per-store rows behind the Combined figures.
  storeRows?: StoreMonthlyCashSummary[];
  // Shown in place of the breakdown when nothing was recorded.
  emptyMessage?: string;
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

// Month-End Cash Summary for one store, or All Stores (the Combined summary):
// eight tiles in a 4 x 2 grid -- the month's cash flows, then the closing
// position -- followed by the rows that explain them. Built from the shared
// StatCard so it reads like Employees, Stores and Inventory. Every figure is
// the API's; nothing is recalculated here. Net daily variance is the last cell
// of the table footer below.
function StoreCashSummaryView({ summary, storeRows = [], emptyMessage }: StoreCashSummaryViewProps) {
  const variance = summary.variance;

  return (
    <section className="card cash-view" aria-label="Month-end cash summary for the store">
      <div className="stat-card-row cash-view__tiles">
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
      </div>

      {summary.daysRecorded === 0 ? (
        <p className="cash-view__empty">{emptyMessage ?? 'No daily cash entries were recorded.'}</p>
      ) : summary.storeId === null ? (
        <StoreBreakdownTable
          stores={storeRows.filter((store) => store.daysRecorded > 0)}
          combined={summary}
        />
      ) : (
        <DailyCashBreakdownTable summary={summary} />
      )}
    </section>
  );
}

export default StoreCashSummaryView;
