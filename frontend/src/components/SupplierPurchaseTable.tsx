import { ChevronRight, Eye } from 'lucide-react';
import UserAvatar from './UserAvatar';
import './SupplierPurchaseTable.css';

export interface SupplierPurchaseRow {
  supplierName: string;
  orderEntryCount: number;
  totalQuantity: number;
}

interface SupplierPurchaseTableProps<T extends SupplierPurchaseRow> {
  rows: T[];
  onViewDetails?: (row: T) => void;
}

// The backend's own sentinel for unassigned order entries (see
// OrderListService.NO_SUPPLIER / SuperAdminOperationsService.NO_SUPPLIER) --
// styled distinctly here rather than as just another named supplier.
const NO_SUPPLIER = 'No Supplier';

// Inner Supplier table shared by all 3 Purchasing Report variants (Super
// Admin's cross-store page, Owner/Admin's single-store page, and Super
// Admin's own per-store Orders drill-down) -- one row per supplier within a
// given store's accordion group. Supplier display (avatar + name) matches
// the Suppliers page's own exactly -- same UserAvatar, same single-letter
// initials, no per-supplier color.
function SupplierPurchaseTable<T extends SupplierPurchaseRow>({ rows, onViewDetails }: SupplierPurchaseTableProps<T>) {
  return (
    <table className="supplier-purchase-table">
      <thead>
        <tr>
          <th scope="col">Supplier</th>
          <th scope="col">Ordered</th>
          <th scope="col">Total</th>
          <th scope="col">Actions</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isUnassigned = row.supplierName === NO_SUPPLIER;
          return (
            <tr
              key={row.supplierName}
              className={isUnassigned ? 'supplier-purchase-table__row--unassigned' : undefined}
            >
              <td data-label="Supplier">
                <div className="supplier-purchase-table__identity">
                  <span className="supplier-purchase-table__avatar-slot">
                    <UserAvatar initials={isUnassigned ? '?' : row.supplierName.charAt(0).toUpperCase()} size={28} />
                  </span>
                  <span className="supplier-purchase-table__name">{row.supplierName}</span>
                </div>
              </td>
              <td data-label="Ordered">
                {row.orderEntryCount} {row.orderEntryCount === 1 ? 'entry' : 'entries'}
              </td>
              <td data-label="Total">
                {row.totalQuantity} {row.totalQuantity === 1 ? 'unit' : 'units'}
              </td>
              <td data-label="Actions">
                {onViewDetails && (
                  <button
                    type="button"
                    className="supplier-purchase-table__view-btn"
                    aria-label="View Details"
                    onClick={() => onViewDetails(row)}
                  >
                    {/* Desktop/tablet: text + chevron. Mobile: icon only --
                        toggled via CSS, see SupplierPurchaseTable.css. The
                        button's own aria-label above covers both states. */}
                    <span className="supplier-purchase-table__view-btn-full" aria-hidden="true">
                      View Details
                      <ChevronRight size={14} />
                    </span>
                    <Eye size={16} className="supplier-purchase-table__view-btn-icon" aria-hidden="true" />
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default SupplierPurchaseTable;
