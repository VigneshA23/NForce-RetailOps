import type { ChecklistHistoryCategory, ChecklistHistoryResponseEntry, ChecklistHistoryTaskItem, ChecklistScheduleType, ChecklistResponseType } from '../types/checklistHistory';

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

// Distinct employees with a real (non-undone) response today -- mirrors the
// backend's CompletionType.isSatisfiedBy threshold check. Exported so the
// admin/super-admin Completed/Flagged table can show "x/2 responded" on a
// MULTIPLE-completion task that's still In Progress (see StoreDetailTable.tsx).
export function activeResponderCount(task: ChecklistHistoryTaskItem): number {
  return new Set(task.responses.filter((r) => !r.undone).map((r) => r.employeeUserId)).size;
}

// A MULTIPLE-completion task needs exactly this many distinct employees to
// respond before taskStatus() calls it COMPLETE -- see taskStatus below.
export const MULTIPLE_COMPLETION_THRESHOLD = 2;

// Whether any employee has a current (non-undone) response to this task.
// Drives the Daily Checklist split: a task an employee has responded to --
// including a flagged one, or a MULTIPLE-completion task still waiting on
// its second responder -- belongs under Completed & Flagged, never under
// Outstanding/Incomplete, even when taskStatus() still reports it as OPEN.
export function hasActiveResponse(task: ChecklistHistoryTaskItem): boolean {
  return task.responses.some((response) => !response.undone);
}

export function taskStatus(task: ChecklistHistoryTaskItem): ChecklistTaskStatus {
  const response = latestResponse(task);
  if (!response) return 'OPEN';
  // A dangling undone response (no resubmission since) isn't a real current
  // answer -- it's only surfaced so its history/name still shows.
  if (response.undone) return 'OPEN';
  if (task.responseType === 'YES_NO' && response.booleanValue === false) return 'ISSUE';
  // Flagged responses need employee attention — treat as ISSUE so the status
  // column updates immediately without waiting for the employee to re-submit.
  if (response.flaggedNeedsCorrection) return 'ISSUE';
  // A MULTIPLE-completion task needs at least 2 distinct employees to have
  // responded -- one employee's response alone leaves it Open, not Complete.
  if (task.completionType === 'MULTIPLE' && activeResponderCount(task) < MULTIPLE_COMPLETION_THRESHOLD) return 'OPEN';
  return 'COMPLETE';
}

export function responseDisplayValue(task: ChecklistHistoryTaskItem): string {
  const response = latestResponse(task);
  if (!response) return '—';
  if (response.undone) return '—';
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

// A single response entry's own value, independent of which one is "latest"
// -- used by the Inactive Tasks section, which lists every historical
// response for a task rather than just the most recent one.
export function formatResponseEntryValue(
  task: Pick<ChecklistHistoryTaskItem, 'responseType' | 'numericUnit'>,
  response: Pick<ChecklistHistoryResponseEntry, 'booleanValue' | 'numericValue' | 'textValue'>,
): string {
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

// "X of Y responded" for a task, matching the Employee checklist's own
// wording/format exactly (EmployeeDashboard.tsx's `${completedByCount}/${totalActiveEmployees} responded`).
export function respondedOfTotalLabel(task: ChecklistHistoryTaskItem): string {
  return `${activeResponderCount(task)}/${task.totalActiveEmployees} responded`;
}

// Single source of truth for what the live Owner/Admin and Super Admin
// checklist tables (Outstanding/Incomplete/Completed & Flagged, stat cards,
// progress bars, trend/repeat-offender aggregates) should ever see: only
// active categories, and within them only active tasks. A category being
// inactive vetoes every task under it, even if a task's own currentlyActive
// still reads true (defensive -- category deactivation already cascades to
// its tasks server-side, but this keeps the live view correct regardless).
// Deactivated items with real response history are NOT lost -- they surface
// separately via inactiveTasksWithHistory below, just excluded from here.
export function visibleCategoriesForLiveView(categories: ChecklistHistoryCategory[]): ChecklistHistoryCategory[] {
  return categories
    .filter((category) => category.active)
    .map((category) => ({ ...category, tasks: category.tasks.filter((task) => task.currentlyActive) }))
    .filter((category) => category.tasks.length > 0);
}

export interface InactiveTaskWithHistory {
  categoryId: number;
  categoryName: string;
  task: ChecklistHistoryTaskItem;
  // 'CATEGORY' when the category itself was deactivated (vetoing every task
  // under it); 'TASK' when only this specific task was deactivated.
  deactivatedScope: 'CATEGORY' | 'TASK';
  deactivatedByName: string | null;
  deactivatedAt: string | null;
}

// The bottom "Inactive Tasks" section's data source: every task that is no
// longer visible in visibleCategoriesForLiveView (its own flag, or its
// category's, is false) but has at least one recorded employee response --
// preserving the audit trail instead of silently dropping it. A task/category
// deactivated with zero response history has nothing to audit and is
// deliberately excluded here too (fully hidden, matching the live table).
export function inactiveTasksWithHistory(categories: ChecklistHistoryCategory[]): InactiveTaskWithHistory[] {
  const result: InactiveTaskWithHistory[] = [];
  for (const category of categories) {
    for (const task of category.tasks) {
      const isInactive = !category.active || !task.currentlyActive;
      if (!isInactive || task.responses.length === 0) continue;
      const scope: 'CATEGORY' | 'TASK' = !category.active ? 'CATEGORY' : 'TASK';
      result.push({
        categoryId: category.id,
        categoryName: category.name,
        task,
        deactivatedScope: scope,
        deactivatedByName: scope === 'CATEGORY' ? category.deactivatedByName : task.deactivatedByName,
        deactivatedAt: scope === 'CATEGORY' ? category.deactivatedAt : task.deactivatedAt,
      });
    }
  }
  return result;
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
  return localDateString(d);
}

export interface DateRange {
  start: string;
  end: string;
}

// The complete Monday-Sunday calendar week immediately before the week
// containing `date` -- e.g. from a Thursday, "last week" is the full prior
// Mon-Sun span, not "7 days ago" (a single day). Independent of which
// weekday `date` falls on, and correct across month/year boundaries since
// it's built entirely from Date's own day-stepping (same local-date
// convention as the rest of this file -- no UTC conversion).
export function previousCalendarWeekRange(date: string): DateRange {
  const d = new Date(`${date}T00:00:00`);
  // getDay(): 0=Sun..6=Sat -- convert to days-since-Monday (0=Mon..6=Sun).
  const daysSinceMonday = (d.getDay() + 6) % 7;
  const thisWeekMonday = new Date(d);
  thisWeekMonday.setDate(d.getDate() - daysSinceMonday);
  const lastWeekMonday = new Date(thisWeekMonday);
  lastWeekMonday.setDate(thisWeekMonday.getDate() - 7);
  const lastWeekSunday = new Date(lastWeekMonday);
  lastWeekSunday.setDate(lastWeekMonday.getDate() + 6);
  return { start: localDateString(lastWeekMonday), end: localDateString(lastWeekSunday) };
}

// Every ISO date from `range.start` to `range.end`, inclusive.
export function datesInRange(range: DateRange): string[] {
  const dates: string[] = [];
  let cursor = range.start;
  while (cursor <= range.end) {
    dates.push(cursor);
    cursor = stepDate(cursor, 1);
  }
  return dates;
}

export function formatDateRangeLabel(range: DateRange): string {
  const start = new Date(`${range.start}T00:00:00`);
  const end = new Date(`${range.end}T00:00:00`);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
  const endLabel = end.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

// toISOString() renders in UTC, which silently shifts the result back a day
// in any timezone ahead of UTC (e.g. IST, UTC+5:30) -- local midnight lands
// on the *previous* UTC day. That made every step net one day short, so the
// "next day" arrow (stepDate(date, 1)) landed back on the same day it
// started from and looked completely broken, while "previous day" merely
// over-shot by an extra day. localDateString reads the Date's own local
// fields instead, matching todayDate()/yesterday()/daysAgo() above.
export function stepDate(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return localDateString(d);
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

// Weekday name at a glance for a short window; "Mon"/"Tue" repeats and gets
// ambiguous once the window spans more than a week, so a longer period spells
// out the date instead. Shared by every completion-trend chart (Admin and
// Super Admin) so their day labels never drift apart.
export function formatTrendDayLabel(isoDate: string, periodDays: number): string {
  const date = new Date(`${isoDate}T00:00:00`);
  return periodDays <= 7
    ? date.toLocaleDateString(undefined, { weekday: 'short' })
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
