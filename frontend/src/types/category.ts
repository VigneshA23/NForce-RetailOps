import type { CategoryBadgeColor } from '../utils/categoryBadge';

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
  badgeColor: CategoryBadgeColor;
  // YYYY-MM-DD; set when created with "Enable Immediately" off. Null = live now.
  startDate: string | null;
}

export type CategoryFormValues = {
  name: string;
  appliesToAllStores: boolean;
  storeIds: number[];
  badgeColor?: CategoryBadgeColor;
  // Create only -- false makes the category go live from tomorrow.
  enableImmediately?: boolean;
};
