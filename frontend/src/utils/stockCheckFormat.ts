// Shared "available (N dead)" formatting for a stock-check count, used by
// both the read-only history list and its correction modal/audit trail.
// available is null for a correction's "previous" value when the snapshot it
// corrected had never been recorded before (see RTS-69).
export function countLabel(available: number | null, deadStock: number | null): string {
  if (available == null) return 'Not recorded';
  return deadStock == null ? String(available) : `${available} (${deadStock} dead)`;
}
