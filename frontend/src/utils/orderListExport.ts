import type { OrderListEntry } from '../types/orderList';
import type { EodSupplierReport } from '../types/stockCheck';

const UNASSIGNED_SUPPLIER_LABEL = 'Unassigned Supplier';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// Deterministic, locale-independent formatting for the copied text -- unlike
// Date.toLocaleDateString(), which varies with the viewer's browser locale.
function formatLongDate(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

// Shared header block for both exported lists: a title, then aligned
// "Store -" / "Date -" lines (the extra spaces line the dashes up in a
// monospace or proportional paste alike), then room to breathe before the
// first supplier group. One shared builder so the two lists can't drift
// into two different header formats.
//
// Each header line is wrapped in single asterisks -- WhatsApp and Slack
// (this text's primary paste targets) both render *text* as bold; anywhere
// that doesn't understand the syntax, it still reads fine as plain text with
// literal asterisks rather than breaking.
function buildHeaderLines(title: string, storeName: string | null | undefined, generatedAt: Date): string[] {
  return [
    `*${title} :*`,
    '',
    `*Store  - ${storeName ?? 'Unknown Store'}*`,
    `*Date   - ${formatLongDate(generatedAt)}*`,
    '',
    '',
    '',
  ];
}

// Plain-text order list grouped by supplier, formatted for pasting into
// WhatsApp/SMS. Only active (non-RECEIVED) entries are included -- a
// received item has nothing left to order.
export function buildOrderListText(entries: OrderListEntry[], storeName: string | null | undefined, generatedAt: Date): string {
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

  const lines = buildHeaderLines('Order List', storeName, generatedAt);

  const supplierNames = [...bySupplier.keys()].sort((a, b) => a.localeCompare(b));
  for (const supplierName of supplierNames) {
    lines.push(supplierName);
    for (const entry of bySupplier.get(supplierName)!) {
      const statusNote = entry.status === 'ORDERED' ? ' (already ordered)' : '';
      lines.push(`* ${entry.itemName} – ${entry.quantityNeeded + entry.manualAddition} ${entry.unitOfMeasurement}${statusNote}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

// Reorder list: unlike buildOrderListText (the full active list, ORDERED
// entries included for reference), this is supplier-facing -- only entries
// still actually needing an order, grouped by supplier for one paste per
// supplier. Grouped by supplierId (falling back to the item itself when
// absent) rather than the supplierName string, so two rows for the same
// supplier can never split into separate groups over incidental name casing
// or whitespace. Returns null when there's nothing to order so the caller
// can show an empty state instead of an empty "REORDER LIST" block.
//
// `generatedAt` is taken as a parameter rather than read internally via
// `new Date()` so the function stays pure and deterministic for testing --
// the caller captures "now" at the moment the user actually clicks Copy.
export function buildReorderListText(
  entries: OrderListEntry[],
  storeName: string | null | undefined,
  generatedAt: Date,
): string | null {
  const needsOrdering = entries.filter((entry) => entry.status === 'NEEDS_ORDERING' && entry.quantityNeeded + entry.manualAddition > 0);
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

  const lines = buildHeaderLines('REORDER LIST', storeName, generatedAt);
  for (const group of sortedGroups) {
    lines.push(group.label);
    for (const entry of group.items) {
      lines.push(`* ${entry.itemName} — ${entry.quantityNeeded + entry.manualAddition} ${entry.unitOfMeasurement}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}

function value(n: number | null): string {
  return n == null ? '—' : String(n);
}

// Usable = available minus dead stock -- the figure every stock total and
// "used" is computed from. Null when that snapshot wasn't taken.
export function usableStock(available: number | null, deadStock: number | null): number | null {
  return available == null ? null : available - (deadStock ?? 0);
}

function withDead(usable: number | null, deadStock: number | null): string {
  return deadStock ? `${value(usable)} (${deadStock} dead)` : value(usable);
}

// Plain-text End of Day report grouped by supplier, for the same
// WhatsApp/SMS paste target as the order lists above. Dated by the report's
// own business day, not "now" -- a report can be copied for any past day.
export function buildEodReportText(report: EodSupplierReport, storeName: string | null | undefined): string {
  if (report.groups.length === 0) {
    return 'No inventory items to report for this day.';
  }

  const lines = buildHeaderLines('End of Day Report', storeName, new Date(`${report.date}T00:00:00`));
  for (const group of report.groups) {
    lines.push(group.supplierName);
    for (const row of group.items) {
      const need = row.quantityToOrder ? ` — order ${row.quantityToOrder} ${row.unitOfMeasurement}` : '';
      const start = withDead(usableStock(row.startOfDayAvailable, row.startOfDayDeadStock), row.startOfDayDeadStock);
      const end = withDead(usableStock(row.endOfDayAvailable, row.endOfDayDeadStock), row.endOfDayDeadStock);
      lines.push(`* ${row.itemName}: start ${start}, end ${end}, used ${value(row.stockUsed)}${need}`);
    }
    lines.push('');
  }

  return lines.join('\n').trim();
}
