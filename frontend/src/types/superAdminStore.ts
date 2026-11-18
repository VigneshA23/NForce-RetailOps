export interface SuperAdminStore {
  storeId: number;
  storeCode: number;
  storeName: string;
  storeLocation: string | null;
  storeActive: boolean;
  // Null for a store that has never had an owner.
  ownerId: number | null;
  ownerName: string | null;
  ownerAvatarUrl?: string | null;
  ownerActive: boolean | null;
  // False when there's no owner at all, or when an owner is/was assigned but
  // their access to this specific store has been revoked.
  ownerAccessActive: boolean;
  employeeCount: number;
  taskCount: number;
  // The store's cash-drawer target. Null only while it is still the untouched
  // platform default (no row saved yet).
  cashTarget: number | null;
}

export interface CreateStoreValues {
  name: string;
  location: string;
  // Required on create; the edit form always sends the current value too.
  cashTarget: number;
}

// The platform default target (store_cash_targets column default, V117).
export const DEFAULT_CASH_TARGET = 100;
