export interface CategoryStoreOption {
  id: number;
  name: string;
}

export interface Category {
  id: number;
  name: string;
  displayOrder: number;
  active: boolean;
  taskCount: number;
  appliesToAllStores: boolean;
  stores: CategoryStoreOption[];
  createdByOwnerId: number | null;
  createdByOwnerName: string;
}

export type CategoryFormValues = {
  name: string;
  appliesToAllStores: boolean;
  storeIds: number[];
};
