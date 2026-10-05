import type { InventoryCountStatus } from '../types/storeInventory';

export interface InventoryCountStatusMeta {
  label: string;
  fg: string;
  bg: string;
  dot: string;
}

// Shared across the Owner/Admin Inventory Counts view and Super Admin's
// cross-store stock-level comparison, so the two can't disagree about what a
// status looks like. NOT_ASSIGNED only applies to the comparison view -- a
// store that has no item of the compared name at all, not a status a single
// store's own inventory can ever be in.
export const INVENTORY_COUNT_STATUS_META: Record<InventoryCountStatus | 'NOT_ASSIGNED', InventoryCountStatusMeta> = {
  OUT_OF_STOCK: { label: 'Out of Stock', fg: '#b3162a', bg: '#fde8ea', dot: '#e11d33' },
  LOW: { label: 'Below Minimum', fg: '#a3620a', bg: '#fdf1de', dot: '#f59e0b' },
  STALE: { label: 'Not Updated Today', fg: '#52525b', bg: '#f1f1f4', dot: '#a1a1aa' },
  HEALTHY: { label: 'Healthy', fg: '#15803d', bg: '#e3f6ea', dot: '#16a34a' },
  NOT_ASSIGNED: { label: 'Not Assigned', fg: '#71717a', bg: '#f4f4f5', dot: '#a1a1aa' },
};
