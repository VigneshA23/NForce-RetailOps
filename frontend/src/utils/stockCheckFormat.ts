// Shared "available (N dead)" formatting for a stock-check count, used by
// both the read-only history list and its correction modal/audit trail.
export function countLabel(available: number, deadStock: number | null): string {
  return deadStock == null ? String(available) : `${available} (${deadStock} dead)`;
}
