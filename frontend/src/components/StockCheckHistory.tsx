import { useEffect, useState } from 'react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import Pagination from './Pagination';
import { getStockCheckHistory } from '../api/storeInventory';
import type { StockCheckEdit, StockCheckResponse, StockSnapshot } from '../types/stockCheck';
import { daysAgo, formatDateLabel, formatTimeLabel, todayDate } from '../utils/checklistHistoryOptions';
import './StockCheckHistory.css';

const PAGE_SIZE = 50;

// DateRangePicker's ALL_TIME preset resolves to `undefined` (no bound) --
// this endpoint requires a bounded range (a missing bound is a 400), so
// ALL_TIME here means "the widest window the 92-day cap allows", not
// literally unbounded.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

function SnapshotCell({ snapshot }: { snapshot: StockSnapshot | null }) {
  if (!snapshot) return <span className="stock-check-history__muted">Not counted</span>;
  return (
    <>
      {snapshot.available}
      {snapshot.deadStock > 0 && <span className="stock-check-history__dead"> ({snapshot.deadStock} dead)</span>}
      <span className="stock-check-history__note">
        by {snapshot.lastUpdatedByName ?? 'Unknown'}
        {snapshot.edited && snapshot.enteredByName ? `, first entered by ${snapshot.enteredByName}` : ''}
      </span>
    </>
  );
}

function countLabel(available: number, deadStock: number | null): string {
  return deadStock == null ? String(available) : `${available} (${deadStock} dead)`;
}

function editLabel(edit: StockCheckEdit): string {
  const which = edit.snapshot === 'START_OF_DAY' ? 'Start of Day' : 'End of Day';
  const from = countLabel(edit.previousAvailable, edit.previousDeadStock);
  const to = countLabel(edit.newAvailable, edit.newDeadStock);
  return `${which} changed from ${from} to ${to} by ${edit.editedByName} at ${formatTimeLabel(edit.editedAt)}`
    + (edit.reason ? ` — ${edit.reason}` : '');
}

// Owner/Admin's read-only stock-check history: each item's Start of Day and
// End of Day counts per day, the usage between them, and every edit made to
// either (previous value included). Lives as a sub-view of the Inventory tab.
function StockCheckHistory() {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StockCheckResponse[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Changing the range resets to page 1 in the same update so the fetch
  // effect below fires exactly once (not once for the range change and
  // again for the page reset).
  function handleRangeChange(next: DateRangeSelection) {
    setDateRange(next);
    setPage(1);
  }

  useEffect(() => {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getStockCheckHistory(resolved.startDate, resolved.endDate, page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setPageCount(result.pageCount);
        setTotalItems(result.totalItems);
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange, page]);

  return (
    <div className="stock-check-history">
      <div className="stock-check-history__toolbar">
        <DateRangePicker value={dateRange} onChange={handleRangeChange} />
      </div>

      {loadError && <div className="stock-check-history__error">{loadError}</div>}

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Date</th>
                <th scope="col">Start of Day</th>
                <th scope="col">End of Day</th>
                <th scope="col">Stock Used</th>
                <th scope="col">To Order</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td data-label="Item">
                    {row.itemName}
                    {row.edits.map((edit, index) => (
                      <span key={index} className="stock-check-history__note stock-check-history__edit">
                        {editLabel(edit)}
                      </span>
                    ))}
                  </td>
                  <td data-label="Date">{formatDateLabel(row.checkDate)}</td>
                  <td data-label="Start of Day"><SnapshotCell snapshot={row.startOfDay} /></td>
                  <td data-label="End of Day"><SnapshotCell snapshot={row.endOfDay} /></td>
                  <td data-label="Stock Used">{row.stockUsed ?? '—'}</td>
                  <td data-label="To Order">{row.quantityToOrder ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!isLoading && !loadError && items.length === 0 && (
          <div className="table-card__empty">No stock checks recorded for the selected range.</div>
        )}
        {isLoading && <div className="table-card__empty">Loading...</div>}
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        totalItems={totalItems}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="stock checks"
      />
    </div>
  );
}

export default StockCheckHistory;
