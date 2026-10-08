import { useEffect, useMemo, useState } from 'react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import { getSupplierPurchaseMetrics } from '../api/superAdminOperations';
import type { StoreSupplierPurchaseMetric } from '../types/orderList';
import { daysAgo, todayDate } from '../utils/checklistHistoryOptions';
import './SupplierPurchaseReport.css';

// Same "no unbounded query" convention as Owner/Admin's SupplierPurchaseReport.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

interface SuperAdminOrdersPurchaseReportProps {
  storeId: number;
}

// Purchasing Report tab on Super Admin's per-store Orders dashboard (RTS-304
// parity) -- same flat, single-store table as Owner/Admin's own
// SupplierPurchaseReport.tsx (reusing its CSS directly), filtered client-side
// from the existing cross-store metrics endpoint rather than a new
// store-scoped one: that endpoint already returns every row tagged with its
// own storeId/storeName (see SuperAdminSupplierPurchaseReport.tsx, which
// groups the same rows by store instead of filtering to one).
function SuperAdminOrdersPurchaseReport({ storeId }: SuperAdminOrdersPurchaseReportProps) {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [allRows, setAllRows] = useState<StoreSupplierPurchaseMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getSupplierPurchaseMetrics(resolved.startDate, resolved.endDate)
      .then((result) => {
        if (!cancelled) setAllRows(result);
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

  const rows = useMemo(() => allRows.filter((row) => row.storeId === storeId), [allRows, storeId]);

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

export default SuperAdminOrdersPurchaseReport;
