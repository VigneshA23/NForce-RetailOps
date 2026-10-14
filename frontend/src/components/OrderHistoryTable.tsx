import CategoryIcon from './CategoryIcon';
import { categoryLabel as categoryLabelOf } from '../types/storeInventory';
import type { OrderHistoryEntry } from '../types/orderList';
import { STATUS_META } from '../utils/orderListStatus';
import { formatDateLabel, formatTimeLabel } from '../utils/checklistHistoryOptions';
import './OrderHistoryTable.css';

interface OrderHistoryTableProps {
  rows: OrderHistoryEntry[];
  isLoading: boolean;
}

// Ordered-at/received-at are full timestamps (unlike the date-only strings
// formatDateLabel was written for elsewhere), so the date and time are split
// out the same way InventoryCounts' own history timeline does.
function renderStamp(at: string | null, byName: string | null) {
  if (!at) return <span className="order-history-table__muted">—</span>;
  return (
    <>
      <div>{formatDateLabel(at.slice(0, 10))} <span className="order-history-table__muted">{formatTimeLabel(at)}</span></div>
      {byName && <div className="order-history-table__by">{byName}</div>}
    </>
  );
}

// Purchasing Report's Detailed view -- one Ordered/Received line per row
// (Needs Ordering never appears here, per OrderStatus.PURCHASED_STATUSES).
// Shares CategoryIcon/STATUS_META with Order List and Inventory Counts so an
// item's look and a status's color never drift between these surfaces.
function OrderHistoryTable({ rows, isLoading }: OrderHistoryTableProps) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table order-history-table">
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Supplier</th>
              <th scope="col">Ordered Qty</th>
              <th scope="col">Received Qty</th>
              <th scope="col">Ordered</th>
              <th scope="col">Received</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const meta = STATUS_META[row.status];
              return (
                <tr key={row.id}>
                  <td data-label="Item">
                    <div className="order-history-table__item-cell">
                      <CategoryIcon category={row.category} name={row.itemName} size={36} imageId={row.imageId} />
                      <div>
                        <div className="order-history-table__item-name">{row.itemName}</div>
                        <div className="order-history-table__item-category">{categoryLabelOf(row.category) || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td data-label="Supplier">{row.supplierName}</td>
                  <td data-label="Ordered Qty">
                    {row.quantityOrdered} <span className="order-history-table__unit">{row.unitOfMeasurement}</span>
                  </td>
                  <td data-label="Received Qty">
                    {row.quantityReceived != null ? (
                      <>
                        {row.quantityReceived} <span className="order-history-table__unit">{row.unitOfMeasurement}</span>
                      </>
                    ) : (
                      <span className="order-history-table__muted">—</span>
                    )}
                  </td>
                  <td data-label="Ordered">{renderStamp(row.orderedAt, row.orderedByName)}</td>
                  <td data-label="Received">{renderStamp(row.receivedAt, row.receivedByName)}</td>
                  <td data-label="Status">
                    <span className="order-history-table__status-pill" style={{ color: meta.fg, background: meta.bg }}>
                      {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!isLoading && rows.length === 0 && (
        <div className="table-card__empty">No ordered or received records found for the selected filters.</div>
      )}
      {isLoading && <div className="table-card__empty">Loading...</div>}
    </div>
  );
}

export default OrderHistoryTable;
