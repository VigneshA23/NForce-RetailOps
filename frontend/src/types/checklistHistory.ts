export type ChecklistResponseType = 'YES_NO' | 'DONE_NOT_DONE' | 'NUMERIC' | 'TEXT';
export type ChecklistCompletionType = 'SINGLE' | 'MULTIPLE';
export type ChecklistScheduleType = 'EVERY_DAY' | 'WEEKDAYS' | 'WEEKENDS' | 'SELECTED_DAYS';

export interface ChecklistHistorySummaryRow {
  storeId: number;
  storeName: string;
  date: string;
  hasChecklist: boolean;
  totalTasks: number;
  completedTasks: number;
  // Tasks whose latest response that day was a Yes/No task answered "No" -- the
  // same Issue definition the Daily Checklist already uses.
  issueCount: number;
}

export type ChecklistTaskDetailStatus = 'COMPLETED' | 'NOT_COMPLETED' | 'ISSUE' | 'INACTIVE';

// One row per task completion event (or one row for a still-pending task) in the
// Daily Operations Summary report's task-level detail (CSV export / Print).
export interface ChecklistHistoryTaskDetailRow {
  storeId: number;
  storeName: string;
  date: string;
  categoryName: string;
  taskName: string;
  status: ChecklistTaskDetailStatus;
  response: string | null;
  employeeFullName: string | null;
  completedAt: string | null;
  // Newest-first full change trail for this row's response (DIRECT correction,
  // FLAG_TO_EMPLOYEE + RESUBMISSION, or UNDONE) -- same shape the History page's
  // "View response history" panel shows. Empty when the response never changed,
  // or for a row with no response at all (NOT_COMPLETED/INACTIVE).
  correctionHistory: AdminCorrectionEntry[];
  responseType: ChecklistResponseType;
  numericUnit: string | null;
}

export interface ChecklistHistoryOperationsReport {
  summary: ChecklistHistorySummaryRow[];
  details: ChecklistHistoryTaskDetailRow[];
}

export interface AdminCorrectionEntry {
  // Null for a synthesized RESUBMISSION entry (no admin_corrections row backs it).
  id: number | null;
  originalValueBoolean: boolean | null;
  originalValueNumeric: number | null;
  originalValueText: string | null;
  correctedValueBoolean: boolean | null;
  correctedValueNumeric: number | null;
  correctedValueText: string | null;
  correctedByFullName: string;
  correctedAt: string;
  reason: string | null;
  // 'DIRECT' | 'FLAG_TO_EMPLOYEE' = an admin action, `correctedByFullName` is the admin.
  // 'RESUBMISSION' = the employee resubmitted a new answer that replaced their own
  // previous one, `correctedByFullName` is the employee.
  correctionType: string;
}

export interface ResubmissionHistoryEntry {
  responseId: number;
  booleanValue: boolean | null;
  numericValue: number | null;
  textValue: string | null;
  respondedAt: string;
  employeeFullName: string;
  flagReason: string | null;
  flaggedByName: string | null;
  flaggedAt: string | null;
  // True when this hop was itself deactivated by the employee's own explicit
  // Undo, before being superseded by a later resubmission.
  undoneByUser: boolean;
}

export interface ChecklistHistoryResponseEntry {
  id: number;
  employeeUserId: number;
  employeeFullName: string;
  // null when the responding user has no StoreEmployee record (e.g. converted
  // to a different role) -- not an error case.
  empId: string | null;
  booleanValue: boolean | null;
  numericValue: number | null;
  textValue: string | null;
  respondedAt: string;
  // Non-null when an admin has corrected this response at least once.
  latestCorrection: AdminCorrectionEntry | null;
  employeeAvatarUrl?: string | null;
  flaggedNeedsCorrection: boolean;
  flagReason: string | null;
  // Oldest-first chain of flagged responses this one replaced via a
  // flag -> resubmit cycle. Empty when it never replaced a flagged response.
  resubmissionHistory: ResubmissionHistoryEntry[];
  // True only for a dangling entry synthesized because the employee explicitly
  // Undid this response and never resubmitted since -- the value fields above
  // still carry the stale pre-undo value; consumers should display an
  // undone/no-answer label instead.
  undone: boolean;
}

export interface AdminCorrectionApplyResponse {
  updatedResponse: ChecklistHistoryResponseEntry;
  correction: AdminCorrectionEntry;
}

export interface ChecklistHistoryTaskItem {
  id: number;
  name: string;
  description: string | null;
  responseType: ChecklistResponseType;
  completionType: ChecklistCompletionType;
  scheduleType: ChecklistScheduleType;
  numericUnit: string | null;
  completed: boolean;
  // False when this task has since been deactivated/reconfigured but still
  // shows up here because it has real historical responses.
  currentlyActive: boolean;
  // Active-employee headcount for this task's store -- the "Y" in "X of Y
  // responded", matching the Employee checklist's own denominator.
  totalActiveEmployees: number;
  // Who deactivated this task and when (best-effort, resolved from the
  // activity log by name -- see backend HistoryTaskItemResponse). Null when
  // currentlyActive is true, or no matching log entry could be found.
  deactivatedByName: string | null;
  deactivatedAt: string | null;
  responses: ChecklistHistoryResponseEntry[];
}

export interface ChecklistHistoryCategory {
  id: number;
  name: string;
  // False means this category itself has been deactivated -- every task under
  // it is treated as inactive for live-view purposes even if a task's own
  // currentlyActive still reads true.
  active: boolean;
  deactivatedByName: string | null;
  deactivatedAt: string | null;
  tasks: ChecklistHistoryTaskItem[];
}

// Mirrors the backend's HistoryIssueResponse -- the same DTO shape the
// employee-facing /me/history/detail endpoint already returns (see
// types/history.ts's RawIssue), now also populated on this owner-facing
// endpoint's `issues` field.
export interface ChecklistHistoryIssue {
  id: number;
  note: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  responseText: string | null;
  respondedByName: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export interface ChecklistHistoryDetail {
  storeId: number;
  storeName: string;
  date: string;
  hasChecklist: boolean;
  categories: ChecklistHistoryCategory[];
  issues: ChecklistHistoryIssue[];
}
