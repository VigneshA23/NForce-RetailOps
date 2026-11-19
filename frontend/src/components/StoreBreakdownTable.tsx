import { Store } from 'lucide-react';
import type { StoreMonthlyCashSummary } from '../types/cashSummary';
import { formatCurrency } from '../utils/currency';
import TableScroll from './TableScroll';
import './DailyCashBreakdownTable.css';

interface StoreBreakdownTableProps {
  // The stores that recorded cash in the month, as returned by the API.
  stores: StoreMonthlyCashSummary[];
  // The API's Combined summary: the footer row, never summed here.
  combined: StoreMonthlyCashSummary;
}

function dayLabel(value: string | null): string {
  if (!value) return '-';
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function money(value: number | null): string {
  return value === null ? '-' : formatCurrency(value);
}

function signed(value: number | null): string {
  if (value === null) return '-';
  if (value === 0) return formatCurrency(0);
  return value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);
}

function signClass(value: number | null): string {
  if (value === null || value === 0) return '';
  return value < 0 ? ' daily-cash__amount--short' : ' daily-cash__amount--over';
}

// All Stores: the per-store figures behind the Combined totals, in the same
// shape and styling as the single-store Daily Breakdown. Combined adds up each
// store's own closing position, so the "As of" date can differ by store.
function StoreBreakdownTable({ stores, combined }: StoreBreakdownTableProps) {
  if (stores.length === 0) return null;

  return (
    <section className="daily-cash" aria-label="Store breakdown">
      <div className="card__header">
        <h3 className="card__title daily-cash__title">
          <Store size={18} aria-hidden="true" />
          Store Breakdown
        </h3>
      </div>
      <p className="daily-cash__lead">
        Expected cash on hand above is the sum of each store’s running total on its own last recorded day (the “As of”
        column). Stores with no entries this month are not listed.
      </p>
      {/* Not a .table-card: that class stacks rows into cards on phones. This
          table keeps its columns on every screen and scrolls sideways instead. */}
      <div className="daily-cash__card">
        <TableScroll>
          <table className="data-table daily-cash__table" aria-label="Store cash breakdown">
            <thead>
              <tr>
                <th scope="col" className="daily-cash__date-col">Store</th>
                <th scope="col">Days</th>
                <th scope="col">As Of</th>
                <th scope="col">Cash Removed</th>
                <th scope="col">Cash Remaining</th>
                <th scope="col">Adjustments</th>
                <th scope="col">Expected Cash on Hand</th>
              </tr>
            </thead>
            <tbody>
              {stores.map((store) => (
                <tr key={store.storeId ?? store.storeName}>
                  <th scope="row" className="daily-cash__date-col">
                    {store.storeName}
                    {store.storeCode !== null && <span className="daily-cash__hint">#{store.storeCode}</span>}
                  </th>
                  <td>{store.daysRecorded}</td>
                  <td>{dayLabel(store.asOfDate)}</td>
                  <td>{money(store.totalCashRemoved)}</td>
                  <td>{money(store.totalCashRemaining)}</td>
                  <td className={signClass(store.adjustments).trim()}>{signed(store.adjustments)}</td>
                  <td>{money(store.expectedCashOnHand)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="daily-cash__date-col">
                  Combined
                  <span className="daily-cash__hint">({stores.length} store{stores.length === 1 ? '' : 's'})</span>
                </th>
                <td>{combined.daysRecorded}</td>
                <td>{dayLabel(combined.asOfDate)}</td>
                <td>{money(combined.totalCashRemoved)}</td>
                  <td>{money(combined.totalCashRemaining)}</td>
                <td className={signClass(combined.adjustments).trim()}>{signed(combined.adjustments)}</td>
                <td>{money(combined.expectedCashOnHand)}</td>
              </tr>
            </tfoot>
          </table>
        </TableScroll>
      </div>
      <p className="daily-cash__note">
        Combined adds up every store that recorded cash this month. Cash removed is recorded only; it is not part of
        expected cash.
      </p>
    </section>
  );
}

export default StoreBreakdownTable;
