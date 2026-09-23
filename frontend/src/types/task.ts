export type TaskResponseType = 'YES_NO' | 'DONE_NOT_DONE' | 'NUMERIC' | 'TEXT';

export type CompletionType = 'SINGLE' | 'MULTIPLE';

// How a response came to exist -- NORMAL is a same-day submission, MOVED is an
// independently-completed moved unit (see types/missedTasks.ts), attributed to
// its original due date but otherwise a normal, fully undoable response.
// MAKEUP_NOW/LINK_FULFILLED are retired (replaced by MOVED) but may still
// appear on historical responses; a LINK_FULFILLED response is permanent and
// never shows an Undo control (canUndo already reflects this from the backend).
export type CompletedVia = 'NORMAL' | 'MOVED' | 'MAKEUP_NOW' | 'LINK_FULFILLED';

// One recorded (still-active) answer to a task, as returned by the backend --
// see TaskResponseSummary on the backend.
export interface TaskResponseSummary {
  id: number;
  employeeUserId: number;
  employeeFullName: string;
  booleanValue: boolean | null;
  numericValue: number | null;
  textValue: string | null;
  respondedAt: string;
  flaggedNeedsCorrection: boolean;
  flagReason: string | null;
  // Optional: older/test fixtures predate this field. Defaults to 'NORMAL'.
  completedVia?: CompletedVia;
}

export interface ChecklistTask {
  id: number;
  name: string;
  description: string | null;
  responseType: TaskResponseType;
  responseNote: string | null;
  numericUnit: string | null;
  numericMin: number | null;
  numericMax: number | null;
  textMaxLength: number | null;
  completionType: CompletionType;
  maxCompletions: number | null;
  // Active responses for this task/store/day, and whether the calling employee
  // may undo one of their own -- both come straight from the backend.
  responses: TaskResponseSummary[];
  canUndo: boolean;
  // "X/Y Completed By" status: X (completedByCount) is the count of distinct ACTIVE
  // employees with at least one active response today, Y (totalActiveEmployees) is
  // the store's active-employee headcount. Deactivated employees count in neither.
  completedByCount: number;
  totalActiveEmployees: number;
  completedByNames: string[];
  // Null/absent for the task's own normal today occurrence. Non-null identifies
  // this entry as an independent "moved" unit (see types/missedTasks.ts),
  // attributed to its original due date -- rendered with a "Due <date>" badge.
  // A category's tasks[] can contain multiple entries sharing the same `id`
  // (one normal unit plus any number of moved units); they are never merged.
  originalDueDate?: string | null;
}

export interface ChecklistCategory {
  id: number;
  name: string;
  tasks: ChecklistTask[];
}

export function isTaskComplete(task: ChecklistTask): boolean {
  return task.responses.length > 0;
}

// Stable per-unit key for a checklist item, since a category's tasks[] can
// contain multiple entries sharing the same taskId (one normal unit plus any
// number of moved units) -- use this instead of task.id wherever a checklist
// item needs to be individually keyed/tracked (draft state, pending/undo
// state, DOM ids, React list keys, etc.).
export function checklistUnitKey(task: Pick<ChecklistTask, 'id' | 'originalDueDate'>): string {
  return `${task.id}:${task.originalDueDate ?? 'today'}`;
}
