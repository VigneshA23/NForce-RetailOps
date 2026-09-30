export interface StoreInventoryItem {
  id: number;
  storeId: number;
  storeName: string;
  name: string;
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
  unitOfMeasurement: string;
  minWeekday: string;
  minWeekend: string;
  preferredSupplierId: number | null;
  note: string;
}
