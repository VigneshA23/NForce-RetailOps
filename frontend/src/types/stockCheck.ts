export type StockCheckSnapshotKey = 'START_OF_DAY' | 'END_OF_DAY';

// One Start of Day or End of Day count. usable = available - deadStock;
// edited is true once it's been re-saved after the first entry.
export interface StockSnapshot {
  available: number;
  deadStock: number;
  usable: number;
  enteredByName: string | null;
  enteredAt: string | null;
  lastUpdatedByName: string | null;
  lastUpdatedAt: string | null;
  edited: boolean;
}

// One edit of an existing snapshot. previousDeadStock/newDeadStock are null
// on edits recorded before dead stock was tracked.
export interface StockCheckEdit {
  snapshot: StockCheckSnapshotKey;
  previousAvailable: number;
  previousDeadStock: number | null;
  newAvailable: number;
  newDeadStock: number | null;
  editedByName: string;
  editedAt: string;
  reason: string | null;
}

// One item's stock record for one business day.
export interface StockCheckResponse {
  id: number;
  storeInventoryItemId: number;
  itemName: string;
  categoryId: number | null;
  categoryName: string | null;
  unitOfMeasurement: string;
  checkDate: string;
  // This day's own par level (set whether or not End of Day was recorded) --
  // distinct from requiredTomorrow below, which is the forward-looking
  // threshold used to drive the order list.
  requiredPar: number | null;
  startOfDay: StockSnapshot | null;
  endOfDay: StockSnapshot | null;
  stockUsed: number | null;
  requiredTomorrow: number | null;
  // Null until End of Day has been counted.
  quantityToOrder: number | null;
  edits: StockCheckEdit[];
}

// GET /api/stores/inventory/stock-checks?startDate=&endDate=&page=&size= --
// shape matches components/Pagination.tsx's props (1-indexed page) so the
// view can pass it through without translation.
export interface StockCheckHistoryPage {
  items: StockCheckResponse[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
}

// One item on the employee's "Report Shortage" picker -- the full store
// catalog (active and inactive alike, matching Owner/Admin's Inventory Items
// list), not just today's active checklist (see DailyStockCheckItem below).
export interface StoreInventoryItemOption {
  storeInventoryItemId: number;
  itemName: string;
  unitOfMeasurement: string;
  active: boolean;
}

// One item on the employee's daily Stock Check screen.
export interface DailyStockCheckItem {
  storeInventoryItemId: number;
  itemName: string;
  unitOfMeasurement: string;
  minTarget: number | null;
  requiredTomorrow: number | null;
  startOfDay: StockSnapshot | null;
  endOfDay: StockSnapshot | null;
  stockUsed: number | null;
  quantityToOrder: number | null;
}
