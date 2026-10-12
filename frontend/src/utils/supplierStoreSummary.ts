import type { Supplier } from '../types/supplier';

// Compresses a supplier's assigned-store set into one short value, the same
// way Items Count compresses a per-store breakdown into one number -- used
// by the Suppliers table's mobile card, which has room for a single line
// here rather than the desktop table's own wrapping store-badge list.
export function supplierStoreSummaryLabel(supplier: Pick<Supplier, 'appliesToAllStores' | 'stores'>): string {
  if (supplier.appliesToAllStores) return 'All Stores';
  const stores = supplier.stores ?? [];
  if (stores.length === 0) return '—';
  if (stores.length === 1) return stores[0].name;
  return `${stores.length} Stores`;
}
