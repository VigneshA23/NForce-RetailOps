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
// fg/bg are theme variables (styles/tokens.css) so the pills follow dark mode;
// their light values are the original colours.
export const INVENTORY_COUNT_STATUS_META: Record<InventoryCountStatus | 'NOT_ASSIGNED', InventoryCountStatusMeta> = {
  OUT_OF_STOCK: { label: 'Out of Stock', fg: 'var(--ops-status-out-fg)', bg: 'var(--ops-status-out-bg)', dot: '#e11d33' },
  LOW: { label: 'Below Minimum', fg: 'var(--ops-status-low-fg)', bg: 'var(--ops-status-low-bg)', dot: '#f59e0b' },
  STALE: { label: 'Not Updated Today', fg: 'var(--ops-status-stale-fg)', bg: 'var(--ops-status-stale-bg)', dot: '#a1a1aa' },
  HEALTHY: { label: 'Healthy', fg: 'var(--ops-status-healthy-fg)', bg: 'var(--ops-status-healthy-bg)', dot: '#16a34a' },
  NOT_ASSIGNED: { label: 'Not Assigned', fg: 'var(--ops-status-none-fg)', bg: 'var(--ops-status-none-bg)', dot: '#a1a1aa' },
};
