export interface StockUpdateStatus {
  updatedToday: boolean;
  // Who last counted it, on its own line; null when no name is on record.
  name: string | null;
  // "Oct 14, 3:45 PM", shown on the line below the name. Empty when there's
  // nothing to show at all (see below) -- the caller treats that as "skip
  // rendering this row's update line entirely".
  when: string;
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// Whether an item's stock was counted today, and who/when to show for it,
// name and date/time kept separate so the caller can stack them on their own
// lines: green when the count is from today, red when it isn't -- so the
// actual age of the count, and who it was, is visible at a glance instead of
// just "Not Updated Today". An Order List row should always have at least
// one SOD/EOD count behind it (that's what raised the shortage in the first
// place), but a manually "Added to order" item can reach the list with no
// count at all -- when is '' then, and the caller skips rendering the line
// entirely rather than show a "Never counted" state this list isn't meant to
// surface.
export function describeStockUpdate(
  lastUpdatedAt: string | null | undefined,
  lastUpdatedByName: string | null | undefined,
  now: Date = new Date(),
): StockUpdateStatus {
  const updatedAt = lastUpdatedAt ? new Date(lastUpdatedAt) : null;
  if (!updatedAt || Number.isNaN(updatedAt.getTime())) {
    return { updatedToday: false, name: null, when: '' };
  }
  const when = `${updatedAt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${updatedAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
  return { updatedToday: isSameLocalDay(updatedAt, now), name: lastUpdatedByName ?? null, when };
}
