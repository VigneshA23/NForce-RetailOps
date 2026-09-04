export interface SuperAdminStore {
  storeId: number;
  storeCode: number;
  storeName: string;
  storeLocation: string | null;
  storeActive: boolean;
  // Null for a store that has never had an owner.
  ownerId: number | null;
  ownerName: string | null;
  ownerActive: boolean | null;
  // False when there's no owner at all, or when an owner is/was assigned but
  // their access to this specific store has been revoked.
  ownerAccessActive: boolean;
  employeeCount: number;
  taskCount: number;
}

export interface CreateStoreValues {
  name: string;
  location: string;
}
