export interface StoreInventoryItem {
  id: number;
  storeId: number;
  storeName: string;
  name: string;
  categoryId: number;
  categoryName: string;
  unitOfMeasurement: string;
  minWeekday: number | null;
  minWeekend: number | null;
  preferredSupplierId: number | null;
  preferredSupplierName: string | null;
  note: string | null;
  active: boolean;
}

// Numbers stay strings until submit, same convention as AdminTaskFormValues'
// numericMin/numericMax.
export interface StoreInventoryItemFormValues {
  storeId: number | null;
  name: string;
  categoryId: number | null;
  unitOfMeasurement: string;
  minWeekday: string;
  minWeekend: string;
  preferredSupplierId: number | null;
  note: string;
}
