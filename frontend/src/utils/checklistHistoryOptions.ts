// Matches the backend's InvalidDateRangeException span cap (ChecklistHistoryService,
// MAX_DATE_RANGE_DAYS) -- a client-side guardrail, not a substitute for that check.
export const MAX_RANGE_DAYS = 92;

export function checklistItemStatusBadgeClass(completed: boolean): string {
  return completed ? 'badge--success' : 'badge--outline';
}

export function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimeLabel(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

// Inclusive day count between two YYYY-MM-DD dates -- the same day counts as 1.
export function diffDaysInclusive(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
}
