import type { InventoryItemCategory } from './storeInventory';

export type OrderStatus = 'NEEDS_ORDERING' | 'ORDERED' | 'RECEIVED';

export interface OrderListEntry {
  id: number;
  storeInventoryItemId: number;
  itemName: string;
  unitOfMeasurement: string;
  quantityNeeded: number;
  manualAddition: number;
  supplierId: number | null;
  supplierName: string | null;
  note: string | null;
  status: OrderStatus;
  adHoc: boolean;
  raisedByName: string | null;
  createdAt: string;
  updatedAt: string;
  imageId: number | null;
  // What actually arrived when the order was marked Received; null otherwise.
  quantityReceived?: number | null;
  // When this entry's current RECEIVED status was reached; null otherwise.
  // Not updatedAt -- that also changes on a plain edit, not just receipt.
  receivedAt?: string | null;
  // Only present on the response to the Ordered -> Received change itself.
  receipt?: ReceiptOutcome | null;
}

// What marking an order received did to the store's stock. stockUpdated is
// false when there was no stock count for today to add the delivery to.
export interface ReceiptOutcome {
  stockUpdated: boolean;
  currentStock: number | null;
  requiredToday: number | null;
  // requiredToday - currentStock, floored at 0; > 0 = still under the minimum.
  shortfall: number | null;
}

export interface UpdateOrderListEntryValues {
  quantityNeeded: string;
  supplierId: number | null;
  note: string;
  status: OrderStatus;
  // The status the user was looking at; the server rejects the edit with a 409
  // if the entry has since been moved by someone else.
  expectedStatus?: OrderStatus;
  // Ordered -> Received only: what arrived. Omitted = everything ordered.
  quantityReceived?: number;
  // Ordered -> Received only: other Ordered rows for the same item that arrived
  // in the same delivery. quantityReceived then covers all of them.
  alsoReceivedEntryIds?: number[];
}

// "Add to order": either an existing catalog item (storeInventoryItemId set)
// or a one-off custom item (itemName/category/unitOfMeasurement set instead).
// saveToInventory, minWeekday and minWeekend only matter for the custom-item
// shape -- ignored server-side when storeInventoryItemId is set, same as
// itemName/category/unitOfMeasurement.
export interface CreateOrderListEntryValues {
  storeInventoryItemId: number | null;
  itemName: string;
  category: InventoryItemCategory | null;
  unitOfMeasurement: string;
  saveToInventory: boolean;
  minWeekday: string;
  minWeekend: string;
  quantityNeeded: string;
  supplierId: number | null;
  note: string;
}

// Owner/Admin's Purchasing Report -- already aggregated server-side
// (COUNT/SUM), scoped to the caller's own store. receivedCount is the subset
// of orderEntryCount whose status is RECEIVED, for the Summary table's
// "Received" column.
export interface SupplierPurchaseMetric {
  supplierName: string;
  orderEntryCount: number;
  totalQuantity: number;
  receivedCount: number;
}

// Super Admin's cross-store version: a flat, already-aggregated list; the
// frontend only groups these rows by storeId for display, it never sums them.
export interface StoreSupplierPurchaseMetric {
  storeId: number;
  storeName: string;
  supplierName: string;
  orderEntryCount: number;
  totalQuantity: number;
  receivedCount: number;
}

// Purchasing Report's Detailed view: one Ordered/Received line (Needs
// Ordering never appears here), with both the ordered and received date/by
// so a shortfall or a slow delivery is visible without cross-referencing
// anything else. storeId/storeName only matter for Super Admin's cross-store
// report, but are always populated.
export interface OrderHistoryEntry {
  id: number;
  storeInventoryItemId: number;
  itemName: string;
  category: string | null;
  unitOfMeasurement: string;
  imageId: number | null;
  supplierId: number | null;
  supplierName: string;
  quantityOrdered: number;
  quantityReceived: number | null;
  status: Exclude<OrderStatus, 'NEEDS_ORDERING'>;
  orderedAt: string | null;
  orderedByName: string | null;
  receivedAt: string | null;
  receivedByName: string | null;
  storeId: number;
  storeName: string;
}

// awaitingReceiptCount/receivedCount are over every row matching the date
// range/supplier filters, independent of pagination.
export interface OrderHistoryPage {
  rows: OrderHistoryEntry[];
  page: number;
  size: number;
  totalPages: number;
  totalElements: number;
  awaitingReceiptCount: number;
  receivedCount: number;
}
