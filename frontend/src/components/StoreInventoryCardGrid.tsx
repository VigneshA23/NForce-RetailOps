import { Trash2 } from 'lucide-react';
import { INVENTORY_ITEM_CATEGORY_OPTIONS, type StoreInventoryItem } from '../types/storeInventory';
import { STOCK_STATUS_META, getStockStatus } from '../utils/storeInventoryStatus';
import ItemIcon from './ItemIcon';
import Toggle from './Toggle';
import './StoreInventoryCardGrid.css';

const CATEGORY_LABELS = Object.fromEntries(INVENTORY_ITEM_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

interface StoreInventoryCardGridProps {
  items: StoreInventoryItem[];
  isLoading?: boolean;
  // The item currently open in the edit panel, if any -- that card keeps its
  // hover-style "popped" look and a red border even once the cursor moves
  // away, until the panel closes or another card is selected.
  selectedId?: number | null;
  onEdit: (item: StoreInventoryItem) => void;
  onDelete: (item: StoreInventoryItem) => void;
  onToggleStatus: (item: StoreInventoryItem, active: boolean) => void;
}

function StoreInventoryCardGrid({ items, isLoading = false, selectedId = null, onEdit, onDelete, onToggleStatus }: StoreInventoryCardGridProps) {
  if (!isLoading && items.length === 0) {
    return <div className="store-inventory-card-grid__empty">No inventory items match your filters.</div>;
  }

  if (isLoading) {
    return <div className="store-inventory-card-grid__empty">Loading inventory...</div>;
  }

  return (
    <div className="store-inventory-card-grid">
      {items.map((item) => {
        const status = getStockStatus(item);
        const statusMeta = STOCK_STATUS_META[status];
        return (
          <article
            key={item.id}
            className={`store-inventory-card store-inventory-card--${status}${item.id === selectedId ? ' store-inventory-card--selected' : ''}`}
            onClick={() => onEdit(item)}
            role="button"
            tabIndex={0}
            aria-label={`Edit ${item.name}`}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onEdit(item);
              }
            }}
          >
            <div className="store-inventory-card__top-row">
              <span className={`store-inventory-card__status store-inventory-card__status--${status}`}>{statusMeta.label}</span>
              <div className="store-inventory-card__top-actions">
                <button
                  type="button"
                  className="store-inventory-card__icon-btn store-inventory-card__icon-btn--danger"
                  aria-label={`Delete ${item.name}`}
                  title="Delete"
                  onClick={(event) => { event.stopPropagation(); onDelete(item); }}
                >
                  <Trash2 size={14} />
                </button>
                <span onClick={(event) => event.stopPropagation()}>
                  <Toggle
                    checked={item.active}
                    onChange={(checked) => onToggleStatus(item, checked)}
                    label={`${item.active ? 'Deactivate' : 'Activate'} ${item.name}`}
                  />
                </span>
              </div>
            </div>

            <div className="store-inventory-card__image">
              <ItemIcon id={item.id} name={item.name} size="xl" imageId={item.imageId} />
            </div>

            {item.category && <span className="store-inventory-card__category">{CATEGORY_LABELS[item.category]}</span>}
            <span className="store-inventory-card__name">{item.name}</span>

            <p className="store-inventory-card__quantities">
              Wkday: {item.minWeekday ?? '—'} {item.unitOfMeasurement}&nbsp;&nbsp;Wkend: {item.minWeekend ?? item.minWeekday ?? '—'} {item.unitOfMeasurement}
            </p>

            <div className="store-inventory-card__on-hand">
              <span>On Hand</span>
              <span className="store-inventory-card__on-hand-value">
                <span className={`store-inventory-card__dot store-inventory-card__dot--${status}`} aria-hidden="true" />
                {item.currentAvailable ?? 'Not counted'}
                {item.currentAvailable != null && ` ${item.unitOfMeasurement}`}
              </span>
            </div>

            <span className="store-inventory-card__supplier">{item.preferredSupplierName ?? 'No Supplier'}</span>
          </article>
        );
      })}
    </div>
  );
}

export default StoreInventoryCardGrid;
