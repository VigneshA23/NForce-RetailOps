import { useEffect, useMemo, useState } from 'react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import { getSupplierPurchaseMetrics } from '../api/superAdminOperations';
import type { StoreSupplierPurchaseMetric } from '../types/orderList';
import { daysAgo, todayDate } from '../utils/checklistHistoryOptions';
import './SuperAdminSupplierPurchaseReport.css';

// Same "no unbounded query" convention as the Owner/Admin version and
// StockCheckHistory: ALL_TIME resolves to the widest window the 92-day cap
// allows, rather than sending no bound at all.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

interface StoreGroup {
  storeId: number;
  storeName: string;
  rows: StoreSupplierPurchaseMetric[];
}

// Super Admin's cross-store Supplier Purchasing Summary. The API already
// returns pre-aggregated, flat rows (one per store+supplier); grouping them
// by storeId here is a display concern only, not a recalculation -- each
// row's own orderEntryCount/totalQuantity is used as-is.
function SuperAdminSupplierPurchaseReport() {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [rows, setRows] = useState<StoreSupplierPurchaseMetric[]>([]);
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

  const groups = useMemo<StoreGroup[]>(() => {
    const byStore = new Map<number, StoreGroup>();
    for (const row of rows) {
      const group = byStore.get(row.storeId);
      if (group) {
        group.rows.push(row);
      } else {
        byStore.set(row.storeId, { storeId: row.storeId, storeName: row.storeName, rows: [row] });
      }
    }
    return [...byStore.values()].sort((a, b) => a.storeName.localeCompare(b.storeName, undefined, { sensitivity: 'base' }));
  }, [rows]);

  return (
    <div className="sa-supplier-purchase-report">
      <div className="sa-supplier-purchase-report__toolbar">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </div>

      {loadError && <div className="sa-supplier-purchase-report__error">{loadError}</div>}

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
            {!isLoading && groups.map((group) => (
              <tbody key={group.storeId}>
                <tr className="sa-supplier-purchase-report__group-row">
                  <th scope="rowgroup" colSpan={3}>
                    {group.storeName}
                    <span className="sa-supplier-purchase-report__group-count">
                      {group.rows.length} supplier{group.rows.length === 1 ? '' : 's'}
                    </span>
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.supplierName}>
                    <td data-label="Supplier">{row.supplierName}</td>
                    <td data-label="Order Entries">{row.orderEntryCount}</td>
                    <td data-label="Total Quantity">{row.totalQuantity}</td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
        {isLoading && <div className="table-card__empty">Loading...</div>}
        {!isLoading && !loadError && groups.length === 0 && (
          <div className="table-card__empty">No purchasing activity found for the selected date range.</div>
        )}
      </div>
    </div>
  );
}

export default SuperAdminSupplierPurchaseReport;
