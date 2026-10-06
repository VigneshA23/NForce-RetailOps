import { useEffect, useState } from 'react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import { getSupplierPurchaseMetrics } from '../api/orderList';
import type { SupplierPurchaseMetric } from '../types/orderList';
import { daysAgo, todayDate } from '../utils/checklistHistoryOptions';
import './SupplierPurchaseReport.css';

// DateRangePicker's ALL_TIME preset resolves to `undefined` (no bound) --
// this endpoint requires a bounded range (a missing bound is a 400), so
// ALL_TIME here means "the widest window the 92-day cap allows", same
// convention as StockCheckHistory.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

// Owner/Admin's Supplier Purchasing Summary: order-entry count and total
// quantity per supplier, for their own (single, server-derived) store, over a
// date range. Lives as a sub-view of the Orders tab alongside Order List,
// Inventory Counts and End of Day Report. The store is never sent by this
// component -- the backend derives it from the authenticated owner.
function SupplierPurchaseReport() {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [rows, setRows] = useState<SupplierPurchaseMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getSupplierPurchaseMetrics(resolved.startDate, resolved.endDate)
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dateRange]);

  return (
    <div className="supplier-purchase-report">
      <div className="supplier-purchase-report__toolbar">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {loadError && <div className="supplier-purchase-report__error">{loadError}</div>}

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Supplier</th>
                <th scope="col">Order Entries</th>
                <th scope="col">Total Quantity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.supplierName}>
                  <td data-label="Supplier">{row.supplierName}</td>
                  <td data-label="Order Entries">{row.orderEntryCount}</td>
                  <td data-label="Total Quantity">{row.totalQuantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {isLoading && <div className="table-card__empty">Loading...</div>}
        {!isLoading && !loadError && rows.length === 0 && (
          <div className="table-card__empty">No purchasing activity found for the selected date range.</div>
        )}
      </div>
    </div>
  );
}

export default SupplierPurchaseReport;
