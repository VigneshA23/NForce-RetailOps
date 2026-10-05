import type { StoreInventoryItem } from '../types/storeInventory';

export type StockStatus = 'low' | 'out' | 'in' | 'inactive';

// Single source of truth for an item's catalog status, shared by the stat
// tiles and the item cards so the two can't disagree about what counts as
// "low" or "out of stock".
export function getStockStatus(item: StoreInventoryItem): StockStatus {
  if (!item.active) return 'inactive';
  if (item.currentAvailable === null || item.currentAvailable <= 0) return 'out';
  if (item.requiredToday !== null && item.currentAvailable < item.requiredToday) return 'low';
  return 'in';
}

export const STOCK_STATUS_META: Record<StockStatus, { label: string; badgeClass: string }> = {
  low: { label: 'Low Stock', badgeClass: 'badge--danger' },
  out: { label: 'Out of Stock', badgeClass: 'badge--warning' },
  in: { label: 'In Stock', badgeClass: 'badge--success' },
  inactive: { label: 'Inactive', badgeClass: 'badge--outline' },
};
