// The built-in categories are stored as their upper-case keys; categories added
// from the item form are stored as the name the user typed.
export type InventoryItemCategory = string;

export const INVENTORY_ITEM_CATEGORY_OPTIONS: { value: InventoryItemCategory; label: string }[] = [
  { value: 'INGREDIENTS', label: 'Ingredients' },
  { value: 'DAIRY', label: 'Dairy' },
  { value: 'FRUITS', label: 'Fruits' },
  { value: 'PACKAGING', label: 'Packaging' },
  { value: 'SUPPLIES', label: 'Supplies' },
  { value: 'CLEANING', label: 'Cleaning' },
];

export function categoryLabel(category: InventoryItemCategory | null | undefined): string {
  if (!category) return '';
  return INVENTORY_ITEM_CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category;
}

// Maps a typed name onto a built-in category when it matches one (so typing
// "dairy" selects Dairy rather than creating a duplicate), else keeps the name.
export function normalizeCategoryName(name: string): InventoryItemCategory {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();
  const builtIn = INVENTORY_ITEM_CATEGORY_OPTIONS.find((o) => o.value.toLowerCase() === lower || o.label.toLowerCase() === lower);
  return builtIn ? builtIn.value : trimmed;
}

// Built-in categories plus any custom ones already used by existing items
// (de-duplicated case-insensitively), so a category added once is offered again.
export function buildCategoryOptions(
  used: (InventoryItemCategory | null | undefined)[],
  extra: (InventoryItemCategory | null | undefined)[] = [],
): { value: InventoryItemCategory; label: string }[] {
  const options = [...INVENTORY_ITEM_CATEGORY_OPTIONS];
  const seen = new Set(options.map((o) => o.value.toLowerCase()));
  for (const raw of [...used, ...extra]) {
    if (!raw) continue;
    const key = raw.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value: raw, label: raw });
  }
  return options;
}

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
  // When true (the default), an End of Day shortfall automatically raises/
  // updates a "Needs Ordering" entry on the Orders tab for this item.
  autoPoEnabled: boolean;
  // Today's minimum: the weekend minimum on Sat/Sun when set, otherwise the
  // weekday minimum (decided server-side).
  requiredToday: number | null;
  // Today's employee stock-check count; null until someone counts it today.
  currentAvailable: number | null;
  // Stored display image (GET /inventory-images/{imageId}); null when none.
  imageId: number | null;
}

// Numbers stay strings until submit, same convention as AdminTaskFormValues'
// numericMin/numericMax.
export interface StoreInventoryItemFormValues {
  storeId: number | null;
  // Super Admin's create form only: every store the item is added to (one
  // linked copy each). Takes precedence over storeId when non-empty.
  storeIds?: number[];
  name: string;
  category: InventoryItemCategory;
  unitOfMeasurement: string;
  minWeekday: string;
  minWeekend: string;
  preferredSupplierId: number | null;
  note: string;
  autoPoEnabled: boolean;
  // Display image: the stored one (edit mode), or a newly picked Unsplash
  // photo the server downloads on save, or a request to remove it.
  imageId: number | null;
  imagePhotoId: string | null;
  // An image the user uploaded themselves, as a base64 data URL.
  imageUploadData?: string | null;
  imagePreviewUrl: string | null;
  removeImage: boolean;
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
  lastUpdatedSource: InventoryCountSource | null;
  change: number | null;
  changeFromDate: string | null;
  latestCheckId: number | null;
  latestSnapshot: 'START_OF_DAY' | 'END_OF_DAY' | null;
  latestAvailable: number | null;
  latestDeadStock: number | null;
  imageId: number | null;
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

// How an entry was made: a Start of Day or End of Day count, or a delivery.
export type InventoryCountSource = 'START_OF_DAY' | 'END_OF_DAY' | 'STOCK_RECEIVED';

// One entry in the history timeline; count is the usable stock after it.
export interface InventoryCountHistoryEntry {
  checkDate: string;
  count: number;
  delta: number | null;
  updatedByName: string | null;
  updatedAt: string;
  source: InventoryCountSource;
}
