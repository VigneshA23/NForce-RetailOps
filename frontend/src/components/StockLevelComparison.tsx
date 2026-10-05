import { useMemo, useState } from 'react';
import { compareStockLevels } from '../api/stockLevelComparison';
import type { StockLevelComparisonRow } from '../types/stockLevelComparison';
import type { StoreInventoryItem } from '../types/storeInventory';
import SearchableSelect from './SearchableSelect';
import StockComparisonTable from './StockComparisonTable';
import './StockLevelComparison.css';

interface StockLevelComparisonProps {
  items: StoreInventoryItem[];
}

function StockLevelComparison({ items }: StockLevelComparisonProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rows, setRows] = useState<StockLevelComparisonRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // There's no shared item catalog -- each store has its own row for "the
  // same" item -- so the picker's options are item names deduplicated
  // case-insensitively, keyed by a stable index rather than any one store's
  // item id.
  const options = useMemo(() => {
    const seen = new Map<string, string>();
    for (const item of items) {
      const key = item.name.trim().toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, item.name.trim());
      }
    }
    return Array.from(seen.values())
      .sort((a, b) => a.localeCompare(b))
      .map((name, index) => ({ id: index, label: name }));
  }, [items]);

  function handleSelect(ids: number[]) {
    const id = ids[0] ?? null;
    setSelectedId(id);
    setRows([]);
    setLoadError(null);
    if (id === null) return;

    const option = options.find((o) => o.id === id);
    if (!option) return;

    setIsLoading(true);
    compareStockLevels(option.label)
      .then(setRows)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  return (
    <div className="slc-page">
      <div className="slc-page__picker">
        <SearchableSelect
          id="stock-comparison-item"
          options={options}
          selectedIds={selectedId === null ? [] : [selectedId]}
          onChange={handleSelect}
          placeholder="Select an item to compare…"
          emptyMessage="No inventory items found"
        />
      </div>

      {loadError && <div className="slc__empty">{loadError}</div>}

      {!loadError && selectedId !== null && (
        <StockComparisonTable rows={rows} isLoading={isLoading} />
      )}
    </div>
  );
}

export default StockLevelComparison;
