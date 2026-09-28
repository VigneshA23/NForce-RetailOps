import { useEffect, useState } from 'react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import Pagination from './Pagination';
import { getStockCheckHistory } from '../api/storeInventory';
import type { StockCheckResponse } from '../types/stockCheck';
import { daysAgo, formatDateLabel, todayDate } from '../utils/checklistHistoryOptions';
import './StockCheckHistory.css';

const PAGE_SIZE = 50;

// DateRangePicker's ALL_TIME preset resolves to `undefined` (no bound) --
// this endpoint requires a bounded range (a missing bound is a 400), so
// ALL_TIME here means "the widest window the 92-day cap allows", not
// literally unbounded.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

// Owner/Admin's read-only stock-check history: every count recorded for
// their store in a date range, corrected rows showing both the corrected
// and original value. Lives as a sub-view of the Inventory tab.
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
                <th scope="col">Count Entered</th>
                <th scope="col">Qty Needed</th>
                <th scope="col">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row) => (
                <tr key={row.id}>
                  <td data-label="Item">{row.itemName}</td>
                  <td data-label="Date">{formatDateLabel(row.checkDate)}</td>
                  <td data-label="Count Entered">
                    {row.currentCount}
                    {row.corrected && (
                      <span className="stock-check-history__correction-note">
                        corrected from {row.originalCurrentCount} by {row.correctedByName}
                      </span>
                    )}
                  </td>
                  <td data-label="Qty Needed">{row.quantityNeeded}</td>
                  <td data-label="Recorded By">{row.checkedByName}</td>
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
