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

// One change to a response's value already resolved into the two values it
// connects, so the page can render it directly without re-deriving anything.
// Two kinds share this shape:
//  - FLAG_RESUBMIT: the owner flagged a response with a comment, the employee
//    resubmitted a new one (fromValue -> toValue are two different response rows).
//  - DIRECT_CORRECTION: the owner edited the response's value in place
//    (fromValue -> toValue are the same row, before/after the edit).
export interface HistoryResubmissionTransition {
  kind: 'FLAG_RESUBMIT' | 'DIRECT_CORRECTION';
  fromValue: string | null;
  toValue: string | null;
  // The owner's comment/reason for the change, if any.
  flagReason: string | null;
  // Who made the change (flagged it, or directly edited it).
  flaggedByName: string | null;
  // Formatted local date+time, or null if unknown -- same convention as
  // completedAt/respondedAt elsewhere in this file.
  flaggedAt: string | null;
  // Only meaningful for FLAG_RESUBMIT: who/when the employee resubmitted.
  // Same as flaggedByName/flaggedAt for DIRECT_CORRECTION (no separate
  // resubmission event -- the owner's edit IS the new value).
  resubmittedByName: string;
  resubmittedAt: string;
}

export interface HistoryTaskDetail {
  id: number;
  name: string;
  status: TaskStatus;
  // The actual value the employee submitted (Yes/No, Done/Not done, a number
  // [+ unit], or free text) -- derived client-side from the backend's raw
  // booleanValue/numericValue/textValue, null when nothing was ever answered.
  responseValue: string | null;
  completedBy: HistoryResponder | null;
  // Formatted local time (e.g. "2:30 PM") of the response used to derive
  // `status`/`completedBy` -- derived client-side from the backend's
  // respondedAt ISO timestamp, not a raw API field.
  completedAt: string | null;
  // Every employee who has completed this task for this store/date, oldest
  // first. For a SINGLE-completion task this is at most one entry (same as
  // completedBy); a MULTIPLE-completion task can have several.
  completedByAll: HistoryResponderEntry[];
  // Oldest-first: one entry per flag -> resubmit cycle or direct owner edit
  // this task's current answer has been through. Empty when never changed.
  resubmissionHistory: HistoryResubmissionTransition[];
}

export interface HistoryCategoryEntry {
  id: number;
  name: string;
  tasksCompleted: number;
  tasksTotal: number;
  tasks: HistoryTaskDetail[];
}

export type IssueStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface HistoryIssueEntry {
  id: number;
  note: string;
  status: IssueStatus;
  responseText: string | null;
  respondedByName: string | null;
  // Formatted local time, derived client-side the same way completedAt is --
  // null until an owner responds.
  respondedAt: string | null;
  raisedAt: string;
}

export interface ShiftHistory {
  date: string;
  storeId: number;
  // Straight from the backend's ChecklistHistoryDetailResponse -- false means
  // no task applied to this store on this date at all, distinct from tasks
  // having applied but none being answered yet.
  hasChecklist: boolean;
  categories: HistoryCategoryEntry[];
  issues: HistoryIssueEntry[];
}
