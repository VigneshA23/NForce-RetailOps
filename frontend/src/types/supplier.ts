export interface SupplierStoreOption {
  id: number;
  name: string;
}

export interface Supplier {
  id: number;
  name: string;
  active: boolean;
  // Super Admin's own Add/Edit Supplier form only (RTS-304 follow-up) --
  // absent on suppliers only ever touched through Owner/Admin's rename-only
  // flow or the inline "Add New Supplier" quick-add.
  contact?: string | null;
  location?: string | null;
  appliesToAllStores?: boolean;
  stores?: SupplierStoreOption[];
}

export interface SupplierFormValues {
  name: string;
  contact?: string;
  location?: string;
  appliesToAllStores?: boolean;
  storeIds?: number[];
}

// deleted: the supplier row was removed. Otherwise it had order history and
// was only marked inactive (deactivated = true).
export interface SupplierDeleteResponse {
  deleted: boolean;
  deactivated: boolean;
}
