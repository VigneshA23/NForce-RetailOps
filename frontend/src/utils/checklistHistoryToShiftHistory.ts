import type {
  ChecklistHistoryCategory,
  ChecklistHistoryDetail,
  ChecklistHistoryIssue,
  ChecklistHistoryResponseEntry,
  ChecklistHistoryTaskItem,
} from '../types/checklistHistory';
import type {
  HistoryCategoryEntry,
  HistoryIssueEntry,
  HistoryResubmissionTransition,
  HistoryTaskDetail,
  ShiftHistory,
  TaskStatus,
} from '../types/history';
import { formatTimeLabel, taskStatus } from './checklistHistoryOptions';

// Adapts the owner/admin-facing ChecklistHistoryDetail (api/checklistHistory.ts)
// into the same display-ready ShiftHistory shape the employee-facing
// api/history.ts already produces, so both feed the shared
// ChecklistDayHistoryView component identically. The two raw shapes are
// field-for-field the same for tasks/responses, so this mirrors
// api/history.ts's converters closely -- the one real difference is task
// status: this uses the richer, already-established admin definition
// (utils/checklistHistoryOptions.ts::taskStatus, which also treats an
// explicitly flagged-for-correction response as an issue) rather than
// re-deriving a narrower Yes/No-only rule.

// Same "last element = latest" convention taskStatus() already relies on,
// kept consistent here rather than re-deriving "latest" by comparing
// respondedAt timestamps like the employee-facing converter does.
function latestResponse(task: ChecklistHistoryTaskItem): ChecklistHistoryResponseEntry | null {
  return task.responses.length === 0 ? null : task.responses[task.responses.length - 1];
}

function toTaskStatus(task: ChecklistHistoryTaskItem): TaskStatus {
  switch (taskStatus(task)) {
    case 'OPEN':
      return 'NOT_ANSWERED';
    case 'ISSUE':
      return 'NO';
    case 'COMPLETE':
      return 'YES';
  }
}

function formatValue(
  entry: { booleanValue: boolean | null; numericValue: number | null; textValue: string | null },
  responseType: ChecklistHistoryTaskItem['responseType'],
): string | null {
  if (entry.booleanValue !== null && entry.booleanValue !== undefined) {
    return responseType === 'YES_NO' ? (entry.booleanValue ? 'Yes' : 'No') : entry.booleanValue ? 'Done' : 'Not done';
  }
  if (entry.numericValue !== null && entry.numericValue !== undefined) return String(entry.numericValue);
  if (entry.textValue !== null && entry.textValue !== undefined && entry.textValue !== '') return entry.textValue;
  return null;
}

function buildResubmissionTransitions(
  latest: ChecklistHistoryResponseEntry,
  responseType: ChecklistHistoryTaskItem['responseType'],
): HistoryResubmissionTransition[] {
  const chain = latest.resubmissionHistory;
  return chain.map((hop, index) => {
    const next = index + 1 < chain.length ? chain[index + 1] : latest;
    return {
      kind: 'FLAG_RESUBMIT' as const,
      fromValue: formatValue(hop, responseType),
      toValue: formatValue(next, responseType),
      flagReason: hop.flagReason,
      flaggedByName: hop.flaggedByName,
      flaggedAt: hop.flaggedAt ? formatTimeLabel(hop.flaggedAt) : null,
      resubmittedByName: next.employeeFullName,
      resubmittedAt: formatTimeLabel(next.respondedAt),
    };
  });
}

function buildDirectCorrectionTransition(
  latest: ChecklistHistoryResponseEntry,
  responseType: ChecklistHistoryTaskItem['responseType'],
): HistoryResubmissionTransition | null {
  const correction = latest.latestCorrection;
  if (!correction || correction.correctionType !== 'DIRECT') return null;
  return {
    kind: 'DIRECT_CORRECTION',
    fromValue: formatValue(
      { booleanValue: correction.originalValueBoolean, numericValue: correction.originalValueNumeric, textValue: correction.originalValueText },
      responseType,
    ),
    toValue: formatValue(
      { booleanValue: correction.correctedValueBoolean, numericValue: correction.correctedValueNumeric, textValue: correction.correctedValueText },
      responseType,
    ),
    flagReason: correction.reason,
    flaggedByName: correction.correctedByFullName,
    flaggedAt: formatTimeLabel(correction.correctedAt),
    resubmittedByName: correction.correctedByFullName,
    resubmittedAt: formatTimeLabel(correction.correctedAt),
  };
}

function toHistoryTask(task: ChecklistHistoryTaskItem): HistoryTaskDetail {
  const latest = latestResponse(task);
  const directCorrection = latest ? buildDirectCorrectionTransition(latest, task.responseType) : null;
  // Backend doesn't guarantee response order -- sort oldest-first for display,
  // same defensive sort api/history.ts's converter applies.
  const completedByAll = [...task.responses]
    .sort((a, b) => new Date(a.respondedAt).getTime() - new Date(b.respondedAt).getTime())
    .map((entry) => ({
      employeeUserId: entry.employeeUserId,
      name: entry.employeeFullName,
      respondedAt: formatTimeLabel(entry.respondedAt),
    }));

  return {
    id: task.id,
    name: task.name,
    status: toTaskStatus(task),
    responseValue: latest ? formatValue(latest, task.responseType) : null,
    completedBy: latest ? { employeeUserId: latest.employeeUserId, name: latest.employeeFullName } : null,
    completedAt: latest ? formatTimeLabel(latest.respondedAt) : null,
    completedByAll,
    resubmissionHistory: latest
      ? [...buildResubmissionTransitions(latest, task.responseType), ...(directCorrection ? [directCorrection] : [])]
      : [],
  };
}

function toHistoryCategory(category: ChecklistHistoryCategory): HistoryCategoryEntry {
  const tasks = category.tasks.map(toHistoryTask);
  return {
    id: category.id,
    name: category.name,
    tasksCompleted: tasks.filter((task) => task.status !== 'NOT_ANSWERED').length,
    tasksTotal: tasks.length,
    tasks,
  };
}

function toHistoryIssue(issue: ChecklistHistoryIssue): HistoryIssueEntry {
  return {
    id: issue.id,
    note: issue.note,
    status: issue.status,
    responseText: issue.responseText,
    respondedByName: issue.respondedByName,
    respondedAt: issue.respondedAt ? formatTimeLabel(issue.respondedAt) : null,
    raisedAt: formatTimeLabel(issue.createdAt),
  };
}

export function toShiftHistory(detail: ChecklistHistoryDetail): ShiftHistory {
  return {
    date: detail.date,
    storeId: detail.storeId,
    hasChecklist: detail.hasChecklist,
    categories: detail.categories.map(toHistoryCategory),
    issues: (detail.issues ?? []).map(toHistoryIssue),
  };
}
