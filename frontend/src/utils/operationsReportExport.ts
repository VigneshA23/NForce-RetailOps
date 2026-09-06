import type { ChecklistHistorySummaryRow, ChecklistHistoryTaskDetailRow, ChecklistTaskDetailStatus } from '../types/checklistHistory';
import { toCsvRow } from './csv';
import { formatDateLabel, formatTimeLabel } from './checklistHistoryOptions';

export interface OperationsSummaryTotals {
  storeId: number;
  storeName: string;
  scheduled: number;
  completed: number;
  issues: number;
}

// One row per store, summed across every date in the selected range -- reuses
// the exact Scheduled/Completed/Issue numbers the backend already computed
// per store-per-day; this only combines them.
export function summarizeByStore(rows: ChecklistHistorySummaryRow[]): OperationsSummaryTotals[] {
  const byStore = new Map<number, OperationsSummaryTotals>();
  for (const row of rows) {
    const existing = byStore.get(row.storeId) ?? {
      storeId: row.storeId,
      storeName: row.storeName,
      scheduled: 0,
      completed: 0,
      issues: 0,
    };
    existing.scheduled += row.totalTasks;
    existing.completed += row.completedTasks;
    existing.issues += row.issueCount;
    byStore.set(row.storeId, existing);
  }
  return Array.from(byStore.values()).sort((a, b) => a.storeName.localeCompare(b.storeName));
}

export function completionPercent(scheduled: number, completed: number): number {
  return scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100);
}

export const TASK_DETAIL_STATUS_LABELS: Record<ChecklistTaskDetailStatus, string> = {
  COMPLETED: 'Completed',
  NOT_COMPLETED: 'Not Completed',
  ISSUE: 'Issue',
};

function formatTimestamp(iso: string | null): string {
  if (!iso) return '';
  return `${formatDateLabel(iso.slice(0, 10))} ${formatTimeLabel(iso)}`;
}

export function buildOperationsReportCsv(
  summary: OperationsSummaryTotals[],
  details: ChecklistHistoryTaskDetailRow[],
  startDate: string,
  endDate: string,
): string {
  const lines: string[] = [];

  lines.push(toCsvRow([`Daily Operations Report — ${startDate === endDate ? startDate : `${startDate} to ${endDate}`}`]));
  lines.push('');

  // ── Store summary ──
  lines.push(toCsvRow(['STORE SUMMARY']));
  lines.push(toCsvRow(['Store', 'Scheduled', 'Completed', 'Completion %', 'Issues']));
  for (const row of summary) {
    lines.push(toCsvRow([row.storeName, row.scheduled, row.completed, `${completionPercent(row.scheduled, row.completed)}%`, row.issues]));
  }

  // ── Category breakdown ──
  lines.push('');
  lines.push(toCsvRow(['CATEGORY BREAKDOWN']));
  lines.push(toCsvRow(['Category', 'Completed', 'Total', 'Completion %']));
  const categoryMap = new Map<string, { completed: number; total: number }>();
  for (const row of details) {
    const cat = categoryMap.get(row.categoryName) ?? { completed: 0, total: 0 };
    cat.total += 1;
    if (row.status === 'COMPLETED') cat.completed += 1;
    categoryMap.set(row.categoryName, cat);
  }
  for (const [name, cat] of Array.from(categoryMap.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(toCsvRow([name, cat.completed, cat.total, `${completionPercent(cat.total, cat.completed)}%`]));
  }

  // ── Task-level detail ──
  lines.push('');
  lines.push(toCsvRow(['TASK DETAIL']));
  lines.push(toCsvRow(['Store', 'Date', 'Category', 'Task', 'Status', 'Response', 'Employee', 'Completed At']));
  for (const row of details) {
    lines.push(toCsvRow([
      row.storeName,
      row.date,
      row.categoryName,
      row.taskName,
      TASK_DETAIL_STATUS_LABELS[row.status],
      row.response ?? '',
      row.employeeFullName ?? '',
      formatTimestamp(row.completedAt),
    ]));
  }

  return lines.join('\r\n');
}
