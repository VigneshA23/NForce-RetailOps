export type InventoryItemCategory = 'INGREDIENTS' | 'DAIRY' | 'FRUITS' | 'PACKAGING' | 'SUPPLIES' | 'CLEANING';

export const INVENTORY_ITEM_CATEGORY_OPTIONS: { value: InventoryItemCategory; label: string }[] = [
  { value: 'INGREDIENTS', label: 'Ingredients' },
  { value: 'DAIRY', label: 'Dairy' },
  { value: 'FRUITS', label: 'Fruits' },
  { value: 'PACKAGING', label: 'Packaging' },
  { value: 'SUPPLIES', label: 'Supplies' },
  { value: 'CLEANING', label: 'Cleaning' },
];

export interface StoreInventoryItem {
  id: number;
  storeId: number;
  storeName: string;
  name: string;
  // Null for items created before category support that haven't been edited since.
  category: InventoryItemCategory | null;
  unitOfMeasurement: string;
  minWeekday: number | null;
  minWeekend: number | null;
  preferredSupplierId: number | null;
  preferredSupplierName: string | null;
  note: string | null;
  active: boolean;
  // Today's minimum: the weekend minimum on Sat/Sun when set, otherwise the
  // weekday minimum (decided server-side).
  requiredToday: number | null;
  // Today's employee stock-check count; null until someone counts it today.
  currentAvailable: number | null;
}

// Numbers stay strings until submit, same convention as AdminTaskFormValues'
// numericMin/numericMax.
export interface StoreInventoryItemFormValues {
  storeId: number | null;
  name: string;
  category: InventoryItemCategory;
  unitOfMeasurement: string;
  minWeekday: string;
  minWeekend: string;
  preferredSupplierId: number | null;
  note: string;
}

export type InventoryCountStatus = 'OUT_OF_STOCK' | 'LOW' | 'STALE' | 'HEALTHY';

// One item's live state on the Inventory Counts view. currentStock/
// lastUpdatedAt/lastUpdatedByName are null for an item that has never been
// counted. latestCheckId/latestSnapshot/latestAvailable/latestDeadStock back
// the "Edit count" modal -- it PATCHes the existing stock-check correction
// endpoint directly (see correctStockCheck), there's no separate edit route.
export interface InventoryCountRow {
  itemId: number;
  name: string;
  category: InventoryItemCategory | null;
  unitOfMeasurement: string;
  currentStock: number | null;
  minimum: number | null;
  status: InventoryCountStatus;
  lastUpdatedAt: string | null;
  lastUpdatedByName: string | null;
  change: number | null;
  changeFromDate: string | null;
  latestCheckId: number | null;
  latestSnapshot: 'START_OF_DAY' | 'END_OF_DAY' | null;
  latestAvailable: number | null;
  latestDeadStock: number | null;
}

// allCount/outCount/lowCount/staleCount are over every active item,
// independent of the search/category/level filters applied to rows -- they
// back the KPI tiles, which stay stable reference points while rows filter.
export interface InventoryCountsPage {
  rows: InventoryCountRow[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  allCount: number;
  outCount: number;
  lowCount: number;
  staleCount: number;
}

export interface InventoryCountHistoryEntry {
  checkDate: string;
  count: number;
  delta: number | null;
  updatedByName: string;
  updatedAt: string;
}
