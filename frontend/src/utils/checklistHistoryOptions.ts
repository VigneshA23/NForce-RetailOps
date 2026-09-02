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
