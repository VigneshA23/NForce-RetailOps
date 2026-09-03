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

// The most recent response for a task -- for a MULTIPLE-completion task with
// several entries, that's the one that best represents its current state.
function latestResponse(task: ChecklistHistoryTaskItem) {
  return task.responses.length === 0 ? null : task.responses[task.responses.length - 1];
}

export function taskStatus(task: ChecklistHistoryTaskItem): ChecklistTaskStatus {
  const response = latestResponse(task);
  if (!response) return 'OPEN';
  if (task.responseType === 'YES_NO' && response.booleanValue === false) return 'ISSUE';
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
