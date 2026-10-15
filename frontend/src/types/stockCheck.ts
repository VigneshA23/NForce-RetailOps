import type { InventoryItemCategory } from './storeInventory';

export type StockCheckSnapshotKey = 'START_OF_DAY' | 'END_OF_DAY';

// One Start of Day or End of Day count. usable = available - deadStock;
// edited is true once it's been re-saved after the first entry.
export interface StockSnapshot {
  available: number;
  deadStock: number;
  usable: number;
  enteredById: number | null;
  enteredByName: string | null;
  enteredAt: string | null;
  lastUpdatedByName: string | null;
  lastUpdatedByAvatarUrl: string | null;
  lastUpdatedAt: string | null;
  edited: boolean;
}

// One edit of an existing snapshot. previousAvailable is null when the
// snapshot had no prior value at all (a correction filling in one that was
// never recorded -- see RTS-69); previousDeadStock/newDeadStock are null on
// edits recorded before dead stock was tracked. editedByRole distinguishes a
// Super Admin's cross-store correction (RTS-306) from a store-side one.
export interface StockCheckEdit {
  snapshot: StockCheckSnapshotKey;
  previousAvailable: number | null;
  previousDeadStock: number | null;
  newAvailable: number;
  newDeadStock: number | null;
  editedByName: string;
  editedByRole: 'SUPER_ADMIN' | 'STORE_USER';
  editedAt: string;
  reason: string | null;
}

// One item's stock record for one business day.
export interface StockCheckResponse {
  id: number;
  storeInventoryItemId: number;
  itemName: string;
  imageId?: number | null;
  // Null for items created before category support (V77) that haven't been
  // edited since.
  category: InventoryItemCategory | null;
  unitOfMeasurement: string;
  checkDate: string;
  // This day's own par level (set whether or not End of Day was recorded) --
  // distinct from requiredTomorrow below, which is the forward-looking
  // threshold used to drive the order list.
  requiredPar: number | null;
  startOfDay: StockSnapshot | null;
  endOfDay: StockSnapshot | null;
  // Delivered today; already excluded from stockUsed.
  quantityReceived?: number;
  stockUsed: number | null;
  requiredTomorrow: number | null;
  // Null until End of Day has been counted.
  quantityToOrder: number | null;
  edits: StockCheckEdit[];
  // Set when End of Day has no count because nobody could count it.
  endOfDaySkipped?: EndOfDaySkipped | null;
}

export interface EndOfDaySkipped {
  reason: string;
  byName: string | null;
  at: string | null;
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

// Super Admin's cross-store history (RTS-305) -- same StockCheckResponse,
// labelled with its store. Returned this way whether scoped to one store or
// every store, so the frontend has one shape to handle either way.
export interface SuperAdminStockCheckResponse {
  storeId: number;
  storeName: string;
  check: StockCheckResponse;
}

export interface SuperAdminStockCheckHistoryPage {
  items: SuperAdminStockCheckResponse[];
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
  // Employee Report Shortage picker only: the usable stock the app currently
  // expects, shown as a hint beside the current-stock field.
  currentStock?: number | null;
  // Employee Report Shortage picker only: orders already placed and not yet
  // received; the "already received" checkbox only applies when there is one.
  openOrders?: OpenOrder[];
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
  quantityReceived?: number;
  // Usable stock now (latest count + deliveries since); null before Start of Day.
  currentStock?: number | null;
  stockUsed: number | null;
  quantityToOrder: number | null;
  imageId: number | null;
  // Received stock reported today that is still waiting on the admin.
  pendingReceivedQuantity?: number;
  // Ordered orders the employee can confirm as received.
  openOrders?: OpenOrder[];
  // The last counted day's End of Day, which Start of Day is reconciled against.
  previousEndOfDay?: PreviousEndOfDay | null;
  // Today's Start of Day request that is waiting on, or was turned down by, the admin.
  startOfDayReview?: StartOfDayReview | null;
  // The order raised from today's Start of Day has been placed, so it is frozen.
  startOfDayLocked?: boolean;
  // Yesterday's End of Day for this item is still unanswered: today's Start of
  // Day is refused until it is answered from the Notifications page.
  missedEndOfDay?: { date: string } | null;
}

// expectedStart = that End of Day plus deliveries since; restockCovered and
// lowerCovered are what today's pending/approved Start of Day requests explain.
export interface PreviousEndOfDay {
  date: string;
  usable: number;
  expectedStart: number;
  submittedById: number | null;
  submittedByName: string | null;
  submittedAt: string | null;
  restockCovered: number;
  lowerCovered: number;
}

export interface StartOfDayReview {
  type: 'RESTOCK' | 'LOWER_COUNT';
  status: 'PENDING' | 'REJECTED';
  quantity: number;
  reason: string | null;
}

export interface OpenOrder {
  id: number;
  quantity: number;
  supplierName: string | null;
  orderedAt: string | null;
}

export type EodReportStatus =
  | 'START_OF_DAY_PENDING'
  | 'END_OF_DAY_PENDING'
  | 'END_OF_DAY_SKIPPED'
  | 'NEEDS_TO_ORDER'
  | 'ORDERED'
  | 'NOT_ORDERED'
  | 'SUFFICIENT'
  | 'NO_MINIMUM_SET';

export interface EodReportRow {
  storeInventoryItemId: number;
  itemName: string;
  unitOfMeasurement: string;
  category: InventoryItemCategory | null;
  imageId: number | null;
  startOfDayAvailable: number | null;
  startOfDayDeadStock: number | null;
  endOfDayAvailable: number | null;
  endOfDayDeadStock: number | null;
  stockUsed: number | null;
  requiredTomorrow: number | null;
  quantityToOrder: number | null;
  status: EodReportStatus;
  // Quantity already placed with the supplier via an active (ORDERED, not
  // yet RECEIVED) Order List entry for this item, if one exists.
  orderedQuantity: number | null;
  // The item's Needs Ordering Order List entry -- what "mark ordered" acts on.
  // Only set for today's and yesterday's report; null when there's nothing to
  // act on (older days are view-only).
  orderEntryId: number | null;
  // The day the order was actually placed (YYYY-MM-DD) -- can be later than
  // the report's own date, e.g. yesterday's shortage ordered today.
  orderedOn: string | null;
  // Why End of Day has no count (status END_OF_DAY_SKIPPED).
  endOfDaySkippedReason?: string | null;
}

// GET /api/stores/inventory/eod-report?date= -- grouped by preferred
// supplier, "No Supplier" last.
export interface EodSupplierReport {
  date: string;
  groups: { supplierId: number | null; supplierName: string; items: EodReportRow[] }[];
  itemsNeedingOrder: number;
  itemsPendingEndOfDay: number;
}
