export type TaskResponseType = 'YES_NO' | 'DONE_NOT_DONE' | 'NUMERIC' | 'TEXT';

export type CompletionType = 'SINGLE' | 'MULTIPLE';

// How a response came to exist -- NORMAL is a same-day submission, MAKEUP_NOW/
// LINK_FULFILLED are "Missed Tasks" (see types/missedTasks.ts). A LINK_FULFILLED
// response is permanent and never shows an Undo control (canUndo already reflects
// this from the backend).
export type CompletedVia = 'NORMAL' | 'MAKEUP_NOW' | 'LINK_FULFILLED';

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
  // Past dates with a PENDING "Missed Tasks" link to today (see types/missedTasks.ts)
  // -- non-empty shows "Will also complete N missed (dates)" on this task's card.
  // Optional: older/test fixtures predate this field. Defaults to empty.
  pendingMakeupDates?: string[];
}

export interface ChecklistCategory {
  id: number;
  name: string;
  tasks: ChecklistTask[];
}

export function isTaskComplete(task: ChecklistTask): boolean {
  return task.responses.length > 0;
}
