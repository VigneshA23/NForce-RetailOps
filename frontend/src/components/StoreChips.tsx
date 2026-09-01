import './StoreChips.css';

export interface StoreChipItem {
  id: number;
  name: string;
}

interface StoreChipsProps {
  stores: StoreChipItem[];
  /** How many chips to show before collapsing the rest into a +N chip. */
  max?: number;
  emptyLabel?: string;
  emptyTitle?: string;
}

const DEFAULT_MAX_VISIBLE = 2;

function chipLabel(store: StoreChipItem): string {
  return store.name || 'Unknown Store';
}

/**
 * Store assignments as pills, capped so a row with many stores can't blow out
 * its column. The remainder collapses into a focusable +N chip that names them
 * in its tooltip.
 */
function StoreChips({ stores, max = DEFAULT_MAX_VISIBLE, emptyLabel = 'No stores', emptyTitle }: StoreChipsProps) {
  if (stores.length === 0) {
    return (
      <span className="store-chip" title={emptyTitle ?? emptyLabel}>
        {emptyLabel}
      </span>
    );
  }

  const visible = stores.slice(0, max);
  const overflow = stores.slice(max);
  const overflowNames = overflow.map(chipLabel).join(', ');

  return (
    <span className="store-chips">
      {visible.map((store) => (
        <span key={store.id} className="store-chip" title={chipLabel(store)}>
          {chipLabel(store)}
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          className="store-chip store-chip--overflow"
          tabIndex={0}
          title={overflowNames}
          aria-label={`Also assigned to ${overflowNames}`}
        >
          +{overflow.length}
        </span>
      )}
    </span>
  );
}

export default StoreChips;
