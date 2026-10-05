import type { InventoryItemCategory } from './storeInventory';

export type OrderStatus = 'NEEDS_ORDERING' | 'ORDERED' | 'RECEIVED';

export interface OrderListEntry {
  id: number;
  storeInventoryItemId: number;
  itemName: string;
  unitOfMeasurement: string;
  quantityNeeded: number;
  supplierId: number | null;
  supplierName: string | null;
  note: string | null;
  status: OrderStatus;
  adHoc: boolean;
  raisedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateOrderListEntryValues {
  quantityNeeded: string;
  supplierId: number | null;
  note: string;
  status: OrderStatus;
}

// "Add to order": either an existing catalog item (storeInventoryItemId set)
// or a one-off custom item (itemName/category/unitOfMeasurement set instead).
// saveToInventory only matters for the custom-item shape.
export interface CreateOrderListEntryValues {
  storeInventoryItemId: number | null;
  itemName: string;
  category: InventoryItemCategory | null;
  unitOfMeasurement: string;
  saveToInventory: boolean;
  quantityNeeded: string;
  supplierId: number | null;
  note: string;
}
