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
}

export interface UpdateOrderListEntryValues {
  quantityNeeded: string;
  supplierId: number | null;
  note: string;
  status: OrderStatus;
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

// Owner/Admin's Supplier Purchasing Summary -- already aggregated server-side
// (COUNT/SUM), scoped to the caller's own store.
export interface SupplierPurchaseMetric {
  supplierName: string;
  orderEntryCount: number;
  totalQuantity: number;
}

// Super Admin's cross-store version: a flat, already-aggregated list; the
// frontend only groups these rows by storeId for display, it never sums them.
export interface StoreSupplierPurchaseMetric {
  storeId: number;
  storeName: string;
  supplierName: string;
  orderEntryCount: number;
  totalQuantity: number;
}
