export interface StoreInventoryItem {
  id: number;
  storeId: number;
  storeName: string;
  categoryId: number | null;
  categoryName: string | null;
  name: string;
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
}

// Numbers stay strings until submit, same convention as AdminTaskFormValues'
// numericMin/numericMax.
export interface StoreInventoryItemFormValues {
  storeId: number | null;
  categoryId: number | null;
  name: string;
  unitOfMeasurement: string;
  minWeekday: string;
  minWeekend: string;
  preferredSupplierId: number | null;
  note: string;
  autoPoEnabled: boolean;
}
