import type { ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { StoreInventoryItem } from '../types/storeInventory';
import Toggle from './Toggle';

interface StoreInventoryTableProps {
  items: StoreInventoryItem[];
  // Only Super Admin's page shows the Store column -- Owner/Admin's items
  // are always their own store, so it'd be redundant there.
  showStore: boolean;
  isLoading?: boolean;
  onEdit: (item: StoreInventoryItem) => void;
  onDelete: (item: StoreInventoryItem) => void;
  onToggleStatus: (item: StoreInventoryItem, active: boolean) => void;
  // Rendered inside the card below the table (e.g. pagination).
  footer?: ReactNode;
}

function minQuantityLabel(item: StoreInventoryItem): string {
  const weekday = item.minWeekday ?? '—';
  const weekend = item.minWeekend ?? item.minWeekday ?? '—';
  return `${weekday} / ${weekend}`;
}

function StoreInventoryTable({ items, showStore, isLoading = false, onEdit, onDelete, onToggleStatus, footer }: StoreInventoryTableProps) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Inventory</th>
              <th scope="col">Category</th>
              <th scope="col">Unit</th>
              <th scope="col">Min (Weekday / Weekend)</th>
              <th scope="col">Preferred Supplier</th>
              <th scope="col">Note</th>
              {showStore && <th scope="col">Store</th>}
              <th scope="col">Status</th>
              <th scope="col" className="table-actions-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td data-label="Inventory">{item.name}</td>
                <td data-label="Category">{item.categoryName}</td>
                <td data-label="Unit">{item.unitOfMeasurement}</td>
                <td data-label="Min">{minQuantityLabel(item)}</td>
                <td data-label="Preferred Supplier">{item.preferredSupplierName ?? '—'}</td>
                <td data-label="Note">{item.note ?? '—'}</td>
                {showStore && <td data-label="Store">{item.storeName}</td>}
                <td data-label="Status">
                  <Toggle
                    checked={item.active}
                    onChange={(checked) => onToggleStatus(item, checked)}
                    label={`${item.active ? 'Deactivate' : 'Activate'} ${item.name}`}
                  />
                </td>
                <td className="table-actions-cell" data-label="Actions">
                  <div className="table-row-actions">
                    <button
                      type="button"
                      className="table-icon-btn"
                      aria-label={`Edit ${item.name}`}
                      title="Edit"
                      onClick={() => onEdit(item)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn--danger"
                      aria-label={`Delete ${item.name}`}
                      title="Delete"
                      onClick={() => onDelete(item)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && items.length === 0 && (
        <div className="table-card__empty">No inventory items match your filters.</div>
      )}
      {isLoading && <div className="table-card__empty">Loading inventory...</div>}
      {footer && footer}
    </div>
  );
}

export default StoreInventoryTable;
