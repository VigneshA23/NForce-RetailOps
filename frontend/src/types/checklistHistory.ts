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
  // same exception/issue definition the Store Details checklist already uses.
  exceptionCount: number;
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
  responses: ChecklistHistoryResponseEntry[];
}

export interface ChecklistHistoryCategory {
  id: number;
  name: string;
  tasks: ChecklistHistoryTaskItem[];
}

export interface ChecklistHistoryDetail {
  storeId: number;
  storeName: string;
  date: string;
  hasChecklist: boolean;
  categories: ChecklistHistoryCategory[];
}
