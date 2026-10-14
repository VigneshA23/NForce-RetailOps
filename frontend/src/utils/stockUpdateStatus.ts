export interface StockUpdateStatus {
  updatedToday: boolean;
  label: string;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Whether an item's stock was counted today, and the line to show for it:
// "Not Updated Today", or "Name · Oct 14, 3:45 PM" for the latest update.
export function describeStockUpdate(
  lastUpdatedAt: string | null | undefined,
  lastUpdatedByName: string | null | undefined,
  now: Date = new Date(),
): StockUpdateStatus {
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null;
  if (!updatedAt || Number.isNaN(updatedAt.getTime()) || !isSameLocalDay(updatedAt, now)) {
    return { updatedToday: false, label: 'Not Updated Today' };
  }
  const when = `${updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  return { updatedToday: true, label: lastUpdatedByName ? `${lastUpdatedByName} · ${when}` : when };
}
