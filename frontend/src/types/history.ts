// Status is derived client-side (see api/history.ts) from the real backend's
// per-task `completed` boolean and its responses' `booleanValue` -- there is
// no such field on the wire. NOT_ANSWERED: no completed response yet. NO
// ("Flagged"): completed, and the most recent response's booleanValue is
// explicitly false. YES ("Complete"): completed, anything else (including
// NUMERIC/TEXT tasks, which have no booleanValue at all).
export type TaskStatus = 'YES' | 'NO' | 'NOT_ANSWERED';

export interface HistoryResponder {
  employeeUserId: number;
  name: string;
}

export interface HistoryResponderEntry extends HistoryResponder {
  // Formatted local time (e.g. "2:30 PM") of this employee's response --
  // derived client-side from the backend's respondedAt ISO timestamp.
  respondedAt: string;
}

export interface HistoryTaskDetail {
  id: number;
  name: string;
  status: TaskStatus;
  completedBy: HistoryResponder | null;
  // Formatted local time (e.g. "2:30 PM") of the response used to derive
  // `status`/`completedBy` -- derived client-side from the backend's
  // respondedAt ISO timestamp, not a raw API field.
  completedAt: string | null;
  // Every employee who has completed this task for this store/date, oldest
  // first. For a SINGLE-completion task this is at most one entry (same as
  // completedBy); a MULTIPLE-completion task can have several.
  completedByAll: HistoryResponderEntry[];
}

export interface HistoryCategoryEntry {
  id: number;
  name: string;
  tasksCompleted: number;
  tasksTotal: number;
  tasks: HistoryTaskDetail[];
}

export interface ShiftHistory {
  date: string;
  storeId: number;
  // Straight from the backend's ChecklistHistoryDetailResponse -- false means
  // no task applied to this store on this date at all, distinct from tasks
  // having applied but none being answered yet.
  hasChecklist: boolean;
  categories: HistoryCategoryEntry[];
}
