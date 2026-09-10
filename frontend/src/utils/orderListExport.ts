import type { OrderListEntry } from '../types/orderList';

// Plain-text order list grouped by supplier, formatted for pasting into
// WhatsApp/SMS. Only active (non-RECEIVED) entries are included -- a
// received item has nothing left to order.
export function buildOrderListText(entries: OrderListEntry[], storeName?: string | null): string {
  const active = entries.filter((entry) => entry.status !== 'RECEIVED');
  if (active.length === 0) {
    return 'No items currently need ordering.';
  }

  const bySupplier = new Map<string, OrderListEntry[]>();
  for (const entry of active) {
    const key = entry.supplierName ?? 'No Supplier Assigned';
    const group = bySupplier.get(key) ?? [];
    group.push(entry);
    bySupplier.set(key, group);
  }

  const lines: string[] = [];
  if (storeName) {
    lines.push(`Order List — ${storeName}`);
    lines.push('');
  }

  const supplierNames = [...bySupplier.keys()].sort((a, b) => a.localeCompare(b));
  for (const supplierName of supplierNames) {
    lines.push(supplierName);
    for (const entry of bySupplier.get(supplierName)!) {
      const statusNote = entry.status === 'ORDERED' ? ' (already ordered)' : '';
      lines.push(`- ${entry.itemName} – ${entry.quantityNeeded} ${entry.unitOfMeasurement}${statusNote}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
