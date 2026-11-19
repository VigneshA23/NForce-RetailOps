import { CalendarDays } from 'lucide-react';
import type { StoreMonthlyCashSummary } from '../types/cashSummary';
import { formatCurrency } from '../utils/currency';
import TableScroll from './TableScroll';
import './DailyCashBreakdownTable.css';

interface DailyCashBreakdownTableProps {
  summary: StoreMonthlyCashSummary;
}

function dayLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function formatSigned(value: number): string {
  if (value === 0) return formatCurrency(0);
  return value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);
}

function signClass(value: number | null): string {
  if (value === null || value === 0) return '';
  return value < 0 ? ' daily-cash__amount--short' : ' daily-cash__amount--over';
}

function money(value: number | null): string {
  return value === null ? '-' : formatCurrency(value);
}

// Per-day figures behind the month totals. Every number is rendered as the API
// returned it -- the Month Total row is the API's own totals, not a sum computed
// here -- so a reader can check the columns add up and see that the highlighted
// last row is where the closing figures come from.
function DailyCashBreakdownTable({ summary }: DailyCashBreakdownTableProps) {
  const days = summary.dailyBreakdown;
  if (days.length === 0) return null;
  const lastIndex = days.length - 1;
  const closingDate = days[lastIndex].businessDate;

  return (
    <section className="daily-cash" aria-label="Daily breakdown">
      <div className="card__header">
        <h3 className="card__title daily-cash__title">
          <CalendarDays size={18} aria-hidden="true" />
          Daily Breakdown
        </h3>
      </div>
      <p className="daily-cash__lead">
        Expected cash on hand above is the month-to-date total on{' '}
        <strong>{dayLabel(closingDate)}</strong>, the last recorded day (highlighted below). It starts from the
        1st of the month; each day adds its cash remaining ± adjustments. Days with no entry are not listed.
      </p>
      {/* Not a .table-card: that class stacks rows into cards on phones. This
          table keeps its columns on every screen and scrolls sideways instead. */}
      <div className="daily-cash__card">
        <TableScroll>
          <table className="data-table daily-cash__table" aria-label="Daily cash breakdown">
            <thead>
              <tr>
                <th scope="col" className="daily-cash__date-col">Date</th>
                <th scope="col">Opening Drawer</th>
                <th scope="col">Cash Removed</th>
                <th scope="col">Cash Remaining</th>
                <th scope="col">Adjustments</th>
                <th scope="col">Day Expected</th>
                <th scope="col">Expected Cash on Hand</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, index) => (
                <tr
                  key={day.businessDate}
                  className={index === lastIndex ? 'daily-cash__row--closing' : undefined}
                  aria-current={index === lastIndex ? 'true' : undefined}
                >
                  <th scope="row" className="daily-cash__date-col">
                    {dayLabel(day.businessDate)}
                    {index === lastIndex && <span className="daily-cash__badge">Closing day</span>}
                  </th>
                  <td>{money(day.openingDrawerCash)}</td>
                  <td>{money(day.cashRemoved)}</td>
                  <td>{money(day.cashRemaining)}</td>
                  <td className={signClass(day.adjustments).trim()}>{formatSigned(day.adjustments)}</td>
                  <td>{money(day.dailyExpected)}</td>
                  <td>{money(day.expectedCashOnHand)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" className="daily-cash__date-col">
                  Month Total
                  <span className="daily-cash__hint">({summary.daysRecorded} day{summary.daysRecorded === 1 ? '' : 's'})</span>
                </th>
                <td aria-label="Opening drawer is not totalled">-</td>
                <td>{money(summary.totalCashRemoved)}</td>
                <td>{money(summary.totalCashRemaining)}</td>
                <td className={signClass(summary.adjustments).trim()}>
                  {summary.adjustments === null ? '-' : formatSigned(summary.adjustments)}
                </td>
                <td aria-label="Day expected is not totalled">-</td>
                <td>{money(summary.expectedCashOnHand)}</td>
              </tr>
            </tfoot>
          </table>
        </TableScroll>
      </div>
      <p className="daily-cash__note">
        Opening drawer cash and cash removed are recorded only; they do not change expected cash. Expected cash on hand
        is a running balance, so it is not added up.
      </p>
    </section>
  );
}

export default DailyCashBreakdownTable;
