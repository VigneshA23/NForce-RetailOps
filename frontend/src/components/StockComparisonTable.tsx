import type { StockLevelComparisonRow } from '../types/stockLevelComparison';
import { INVENTORY_COUNT_STATUS_META } from '../utils/inventoryCountStatusMeta';
import { formatDateLabel } from '../utils/checklistHistoryOptions';
import './StockComparisonTable.css';

interface StockComparisonTableProps {
  rows: StockLevelComparisonRow[];
  isLoading: boolean;
}

function StockComparisonTable({ rows, isLoading }: StockComparisonTableProps) {
  if (isLoading) {
    return <div className="slc__loading">Comparing stores…</div>;
  }

  if (rows.length === 0) {
    return <div className="slc__empty">No active stores found.</div>;
  }

  return (
    <div className="card slc">
      <table className="slc__table slc__desktop">
        <thead>
          <tr>
            <th className="slc__th">Store</th>
            <th className="slc__th slc__th--center">Required Today</th>
            <th className="slc__th slc__th--center">Current Available</th>
            <th className="slc__th slc__th--center">As Of</th>
            <th className="slc__th slc__th--center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const meta = INVENTORY_COUNT_STATUS_META[row.status ?? 'NOT_ASSIGNED'];
            return (
              <tr key={row.storeId} className="slc__row">
                <td className="slc__td slc__td--name" data-label="Store">{row.storeName}</td>
                <td className="slc__td slc__td--center" data-label="Required Today">
                  {row.assigned ? (row.requiredToday ?? '—') : <span className="slc__none">—</span>}
                </td>
                <td className="slc__td slc__td--center" data-label="Current Available">
                  {row.assigned ? (row.currentAvailable ?? '—') : <span className="slc__none">—</span>}
                </td>
                <td className="slc__td slc__td--center" data-label="As Of">
                  {row.assigned && row.asOfDate ? formatDateLabel(row.asOfDate) : <span className="slc__none">—</span>}
                </td>
                <td className="slc__td slc__td--center" data-label="Status">
                  <span className="slc__status-pill" style={{ color: meta.fg, background: meta.bg }}>
                    <span className="slc__status-dot" style={{ background: meta.dot }} />
                    {meta.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Mobile-only: the table above is hidden below --mobile in favor of this card list. */}
      <div className="slc__mobile-cards">
        {rows.map((row) => {
          const meta = INVENTORY_COUNT_STATUS_META[row.status ?? 'NOT_ASSIGNED'];
          return (
            <div className="slc-mobile-card" key={row.storeId}>
              <div className="slc-mobile-card__header">
                <span className="slc-mobile-card__name">{row.storeName}</span>
                <span className="slc__status-pill" style={{ color: meta.fg, background: meta.bg }}>
                  <span className="slc__status-dot" style={{ background: meta.dot }} />
                  {meta.label}
                </span>
              </div>

              <div className="slc-mobile-card__row">
                <span className="slc-mobile-card__label">Required Today</span>
                <span>{row.assigned ? (row.requiredToday ?? '—') : '—'}</span>
              </div>
              <div className="slc-mobile-card__row">
                <span className="slc-mobile-card__label">Current Available</span>
                <span>{row.assigned ? (row.currentAvailable ?? '—') : '—'}</span>
              </div>
              <div className="slc-mobile-card__row">
                <span className="slc-mobile-card__label">As Of</span>
                <span>{row.assigned && row.asOfDate ? formatDateLabel(row.asOfDate) : '—'}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default StockComparisonTable;
