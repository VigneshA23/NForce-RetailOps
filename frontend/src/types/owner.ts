export interface OwnerSummary {
  ownerId: number;
  ownerName: string;
  ownerEmail: string;
  ownerActive: boolean;
  storeId: number;
  storeCode: number;
  storeName: string;
  storeLocation: string;
  storeActive: boolean;
}

export type OwnerFormValues = {
  ownerName: string;
  ownerEmail: string;
  storeName: string;
  storeLocation: string;
};

export type AssignStoreValues = {
  storeName: string;
  storeLocation: string;
};
