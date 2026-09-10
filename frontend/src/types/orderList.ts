export type OrderStatus = 'NEEDS_ORDERING' | 'ORDERED' | 'RECEIVED';

export interface OrderListEntry {
  id: number;
  inventoryItemId: number;
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
