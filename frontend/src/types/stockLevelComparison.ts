import type { InventoryCountStatus } from './storeInventory';

// One store's row on Super Admin's cross-store stock-level comparison for a
// single item (matched by name -- there is no shared item catalog). When
// assigned is false every other field is null, never 0 or blank, so "not
// assigned" can't be mistaken for "assigned with zero stock".
export interface StockLevelComparisonRow {
  storeId: number;
  storeName: string;
  assigned: boolean;
  requiredToday: number | null;
  currentAvailable: number | null;
  asOfDate: string | null;
  status: InventoryCountStatus | null;
}
