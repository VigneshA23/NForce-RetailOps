export interface InventoryCategoryStoreOption {
  id: number;
  name: string;
}

// Super Admin-managed inventory category catalog, assigned to specific
// stores or All Stores -- mirrors types/supplier.ts's Supplier shape.
// Distinct from the plain string InventoryItemCategory (an item's own,
// unrestricted category label) in types/storeInventory.ts.
export interface InventoryCategoryRecord {
  id: number;
  name: string;
  active: boolean;
  appliesToAllStores: boolean;
  stores: InventoryCategoryStoreOption[];
}

export interface InventoryCategoryFormValues {
  name: string;
  appliesToAllStores: boolean;
  storeIds: number[];
}

// deleted: the category row was removed. Otherwise an item still uses it and
// it was only marked inactive (deactivated = true).
export interface InventoryCategoryDeleteResponse {
  deleted: boolean;
  deactivated: boolean;
}
