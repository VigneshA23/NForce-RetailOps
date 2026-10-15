export interface StockUpdateStatus {
  updatedToday: boolean;
  label: string;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Whether an item's stock was counted today, and the line to show for it:
// "Name · Oct 14, 3:45 PM" either way, green for a count from today, red
// (same format, not just the bare date) when the last count wasn't today --
// so the actual age of the count, and who it was, is visible at a glance
// instead of just "Not Updated Today". An Order List row should always have
// at least one SOD/EOD count behind it (that's what raised the shortage in
// the first place), but a manually "Added to order" item can reach the list
// with no count at all -- label is '' then, and the caller skips rendering
// the line entirely rather than show a "Never counted" state this list isn't
// meant to surface.
export function describeStockUpdate(
  lastUpdatedAt: string | null | undefined,
  lastUpdatedByName: string | null | undefined,
  now: Date = new Date(),
): StockUpdateStatus {
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null;
  if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
    return { updatedToday: false, label: '' };
  }
  const when = `${updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  const label = lastUpdatedByName ? `${lastUpdatedByName} · ${when}` : when;
  return { updatedToday: isSameLocalDay(updatedAt, now), label };
}
