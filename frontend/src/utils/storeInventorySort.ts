import { INVENTORY_ITEM_CATEGORY_OPTIONS } from '../types/storeInventory';

// Shared between StoreInventory.tsx (Owner/Admin) and SuperAdminInventory.tsx
// so both roles sort/filter their Inventory tab's catalog identically.
export type SortOption = 'name' | 'status' | 'supplier' | 'category';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Sort: Category & Name' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'supplier', label: 'Sort: Supplier' },
  { value: 'category', label: 'Sort: Category' },
];

export const CATEGORY_LABELS = Object.fromEntries(INVENTORY_ITEM_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

export const STATUS_SORT_ORDER = { low: 0, out: 1, in: 2, inactive: 3 } as const;
