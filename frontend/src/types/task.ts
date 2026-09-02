export type TaskResponseType = 'YES_NO' | 'DONE_NOT_DONE' | 'NUMERIC' | 'TEXT';

export type CompletionType = 'SINGLE' | 'MULTIPLE';

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
}

export interface ChecklistCategory {
  id: number;
  name: string;
  tasks: ChecklistTask[];
}

export function isTaskComplete(task: ChecklistTask): boolean {
  return task.responses.length > 0;
}
