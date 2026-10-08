// Shared between StoreInventory.tsx (Owner/Admin) and SuperAdminInventory.tsx
// so both roles sort their Inventory tab's catalog identically. Category
// labelling itself goes through types/storeInventory.ts's categoryLabel()
// instead, which (unlike a fixed lookup) also handles custom categories.
export type SortOption = 'name' | 'status' | 'supplier' | 'category';

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Sort: Category & Name' },
  { value: 'status', label: 'Sort: Status' },
  { value: 'supplier', label: 'Sort: Supplier' },
  { value: 'category', label: 'Sort: Category' },
];

export const STATUS_SORT_ORDER = { low: 0, out: 1, in: 2, inactive: 3 } as const;
