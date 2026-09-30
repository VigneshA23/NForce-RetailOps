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

const UNASSIGNED_SUPPLIER_LABEL = 'Unassigned Supplier';

// Reorder list: unlike buildOrderListText (the full active list, ORDERED
// entries included for reference), this is supplier-facing -- only entries
// still actually needing an order, grouped by supplier for one paste per
// supplier. Grouped by supplierId (falling back to the item itself when
// absent) rather than the supplierName string, so two rows for the same
// supplier can never split into separate groups over incidental name casing
// or whitespace. Returns null when there's nothing to order so the caller
// can show an empty state instead of an empty "REORDER LIST" block.
export function buildReorderListText(entries: OrderListEntry[]): string | null {
  const needsOrdering = entries.filter((entry) => entry.status === 'NEEDS_ORDERING' && entry.quantityNeeded > 0);
  if (needsOrdering.length === 0) {
    return null;
  }

  const named = new Map<string, { label: string; items: OrderListEntry[] }>();
  const unassigned: OrderListEntry[] = [];

  for (const entry of needsOrdering) {
    const label = entry.supplierName?.trim();
    if (entry.supplierId == null || !label) {
      unassigned.push(entry);
      continue;
    }
    const key = String(entry.supplierId);
    const group = named.get(key);
    if (group) {
      group.items.push(entry);
    } else {
      named.set(key, { label, items: [entry] });
    }
  }

  const sortedGroups = [...named.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }),
  );
  if (unassigned.length > 0) {
    sortedGroups.push({ label: UNASSIGNED_SUPPLIER_LABEL, items: unassigned });
  }

  const lines: string[] = ['REORDER LIST', ''];
  for (const group of sortedGroups) {
    lines.push(group.label);
    for (const entry of group.items) {
      lines.push(`* ${entry.itemName} — ${entry.quantityNeeded} ${entry.unitOfMeasurement}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
