import type { ChecklistHistoryTaskItem, ChecklistScheduleType, ChecklistResponseType } from '../types/checklistHistory';

// Matches the backend's InvalidDateRangeException span cap (ChecklistHistoryService,
// MAX_DATE_RANGE_DAYS) -- a client-side guardrail, not a substitute for that check.
export const MAX_RANGE_DAYS = 92;

const SCHEDULE_TYPE_LABELS: Record<ChecklistScheduleType, string> = {
  EVERY_DAY: 'Every day',
  WEEKDAYS: 'Weekdays',
  WEEKENDS: 'Weekends',
  SELECTED_DAYS: 'Selected days',
};

const RESPONSE_TYPE_LABELS: Record<ChecklistResponseType, string> = {
  YES_NO: 'Yes/No',
  DONE_NOT_DONE: 'Checkbox',
  NUMERIC: 'Number',
  TEXT: 'Text',
};

// e.g. "Every day · Yes/No" or "Weekdays · Number · multi" for a MULTIPLE-completion task.
export function taskFrequencyLabel(task: ChecklistHistoryTaskItem): string {
  const base = `${SCHEDULE_TYPE_LABELS[task.scheduleType]} · ${RESPONSE_TYPE_LABELS[task.responseType]}`;
  return task.completionType === 'MULTIPLE' ? `${base} · multi` : base;
}

export type ChecklistTaskStatus = 'OPEN' | 'COMPLETE' | 'ISSUE';

export const TASK_STATUS_LABELS: Record<ChecklistTaskStatus, string> = {
  OPEN: 'Open',
  COMPLETE: 'Complete',
  ISSUE: 'Issue',
};

// The most recent response for a task -- for a MULTIPLE-completion task with
// several entries, that's the one that best represents its current state.
function latestResponse(task: ChecklistHistoryTaskItem) {
  return task.responses.length === 0 ? null : task.responses[task.responses.length - 1];
}

export function taskStatus(task: ChecklistHistoryTaskItem): ChecklistTaskStatus {
  const response = latestResponse(task);
  if (!response) return 'OPEN';
  if (task.responseType === 'YES_NO' && response.booleanValue === false) return 'ISSUE';
  // Flagged responses need employee attention — treat as ISSUE so the status
  // column updates immediately without waiting for the employee to re-submit.
  if (response.flaggedNeedsCorrection) return 'ISSUE';
  return 'COMPLETE';
}

export function responseDisplayValue(task: ChecklistHistoryTaskItem): string {
  const response = latestResponse(task);
  if (!response) return '—';
  if (response.booleanValue !== null) {
    if (task.responseType === 'YES_NO') return response.booleanValue ? 'Yes' : 'No';
    return response.booleanValue ? 'Done' : 'Not done';
  }
  if (response.numericValue !== null) {
    return task.numericUnit ? `${response.numericValue} ${task.numericUnit}` : String(response.numericValue);
  }
  if (response.textValue !== null && response.textValue !== '') return response.textValue;
  return '—';
}

export function checklistItemStatusBadgeClass(completed: boolean): string {
  return completed ? 'badge--success' : 'badge--outline';
}

function localDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function todayDate(): string {
  return localDateString(new Date());
}

export function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return localDateString(d);
}

export function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return localDateString(d);
}

export function lastWeekSameDay(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() - 7);
  return d.toISOString().slice(0, 10);
}

export function stepDate(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function formatDateNavLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatTimeLabel(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
