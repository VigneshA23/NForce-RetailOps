export type AuditStatus = 'AUDITED' | 'PENDING_AUDIT' | 'NOT_AUDITED';

export type TaskStatus = 'YES' | 'NO' | 'NOT_ANSWERED';

export interface HistoryStaffMember {
  id: string;
  name: string;
  initials: string;
}

export interface HistoryTaskDetail {
  id: string;
  name: string;
  status: TaskStatus;
  completedBy: HistoryStaffMember | null;
  completedAt: string | null;
}

export interface HistoryCategoryEntry {
  id: string;
  name: string;
  completedAt: string | null;
  scheduledFor: string | null;
  auditStatus: AuditStatus;
  auditedBy: string | null;
  auditNote: string | null;
  tasksCompleted: number;
  tasksTotal: number;
  staff: HistoryStaffMember[];
  tasks: HistoryTaskDetail[];
}

export interface DailySummary {
  onTimePercent: number;
  totalTasks: number;
  audits: number;
}

export interface ShiftHistory {
  date: string;
  storeId: string;
  categories: HistoryCategoryEntry[];
  summary: DailySummary;
}
