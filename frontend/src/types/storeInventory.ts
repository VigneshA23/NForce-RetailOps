export interface StoreInventoryItem {
  id: number;
  inventoryItemId: number;
  itemName: string;
  categoryName: string;
  unitOfMeasurement: string;
  minWeekday: number | null;
  minWeekend: number | null;
  preferredSupplierId: number | null;
  preferredSupplierName: string | null;
  active: boolean;
}

// minWeekday/minWeekend as strings -- form-editable, converted to
// number|null when building the request payload, same convention as
// AdminTaskFormValues' numericMin/numericMax.
export interface StoreInventoryItemConfigFormValues {
  minWeekday: string;
  minWeekend: string;
  preferredSupplierId: number | null;
}
