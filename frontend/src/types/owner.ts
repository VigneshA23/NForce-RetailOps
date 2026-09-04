export interface OwnerSummary {
  ownerId: number;
  ownerName: string;
  ownerEmail: string;
  ownerActive: boolean;
  storeId: number | null;
  storeCode: number | null;
  storeName: string | null;
  storeLocation: string | null;
  storeActive: boolean | null;
}

export type OwnerStoreMode = 'new' | 'existing' | 'none';

export type AddOwnerValues = {
  ownerName: string;
  ownerEmail: string;
  storeName?: string;
  storeLocation?: string;
  existingStoreId?: number;
};

export type AssignStoreValues = {
  storeName: string;
  storeLocation: string;
};

export interface ReassignableStore {
  storeId: number;
  storeCode: number;
  storeName: string;
  storeLocation: string;
  // Null for a store that has never had an owner.
  currentOwnerName: string | null;
}

export interface OwnerCreationResult {
  owner: OwnerSummary;
  temporaryPassword: string;
}
