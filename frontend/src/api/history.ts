import type { HistoryCategoryEntry, HistoryIssueEntry, HistoryResubmissionTransition, HistoryTaskDetail, IssueStatus, ShiftHistory, TaskStatus } from '../types/history';
import { authHeaders } from '../utils/authStorage';
import { formatTimeLabel } from '../utils/checklistHistoryOptions';
import { fetchWithTimeout } from './client';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

async function parseErrorMessage(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json();
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
}

// Mirrors the backend's ChecklistHistoryDetailResponse family exactly (see the
// owner-facing equivalent in types/checklistHistory.ts, reused read-only by
// GET /api/me/history/detail) -- kept private to this file since EmployeeHistory.tsx
// only ever sees the derived ShiftHistory shape below.
interface RawResubmissionHistoryEntry {
  responseId: number;
  booleanValue: boolean | null;
  numericValue: number | null;
  textValue: string | null;
  respondedAt: string;
  employeeFullName: string;
  flagReason: string | null;
  flaggedByName: string | null;
  flaggedAt: string | null;
}

// Mirrors the backend's AdminCorrectionEntry -- a DIRECT edit's before/after
// value plus who made it, when, and why.
interface RawAdminCorrectionEntry {
  originalValueBoolean: boolean | null;
  originalValueNumeric: number | null;
  originalValueText: string | null;
  correctedValueBoolean: boolean | null;
  correctedValueNumeric: number | null;
  correctedValueText: string | null;
  correctedByFullName: string;
  correctedAt: string;
  reason: string | null;
  correctionType: string; // 'DIRECT' | 'FLAG_TO_EMPLOYEE'
}

interface RawResponseEntry {
  id: number;
  employeeUserId: number;
  employeeFullName: string;
  empId: string | null;
  booleanValue: boolean | null;
  numericValue: number | null;
  textValue: string | null;
  respondedAt: string;
  latestCorrection: RawAdminCorrectionEntry | null;
  resubmissionHistory: RawResubmissionHistoryEntry[];
}

interface RawTaskItem {
  id: number;
  name: string;
  description: string | null;
  responseType: 'YES_NO' | 'DONE_NOT_DONE' | 'NUMERIC' | 'TEXT';
  completionType: 'SINGLE' | 'MULTIPLE';
  completed: boolean;
  currentlyActive: boolean;
  responses: RawResponseEntry[];
}

interface RawCategory {
  id: number;
  name: string;
  tasks: RawTaskItem[];
}

interface RawIssue {
  id: number;
  note: string;
  status: IssueStatus;
  responseText: string | null;
  respondedByName: string | null;
  respondedAt: string | null;
  createdAt: string;
}

interface RawDetail {
  storeId: number;
  storeName: string;
  date: string;
  hasChecklist: boolean;
  categories: RawCategory[];
  issues: RawIssue[];
}

// The backend doesn't guarantee response order, so the most recent one (by
// respondedAt) is picked as the task's "current" answer for display/status --
// matters most for MULTIPLE-completion tasks, which can have several.
function latestResponse(responses: RawResponseEntry[]): RawResponseEntry | null {
  if (responses.length === 0) return null;
  return responses.reduce((latest, entry) =>
    new Date(entry.respondedAt) > new Date(latest.respondedAt) ? entry : latest,
  );
}

// No completed response -> Not answered. Completed and the most recent
// response explicitly answered "No" -> Flagged. Anything else completed
// (including NUMERIC/TEXT tasks, which have no booleanValue at all) -> Complete.
function deriveTaskStatus(task: RawTaskItem, latest: RawResponseEntry | null): TaskStatus {
  if (!task.completed || !latest) return 'NOT_ANSWERED';
  return latest.booleanValue === false ? 'NO' : 'YES';
}

// Renders the same value regardless of whether it comes from a live response
// or a historical resubmission-chain entry -- both share this boolean/numeric/
// text shape.
function formatRawValue(
  entry: { booleanValue: boolean | null; numericValue: number | null; textValue: string | null },
  responseType: RawTaskItem['responseType'],
): string | null {
  if (entry.booleanValue !== null && entry.booleanValue !== undefined) {
    return responseType === 'YES_NO' ? (entry.booleanValue ? 'Yes' : 'No') : entry.booleanValue ? 'Done' : 'Not done';
  }
  if (entry.numericValue !== null && entry.numericValue !== undefined) return String(entry.numericValue);
  if (entry.textValue !== null && entry.textValue !== undefined && entry.textValue !== '') return entry.textValue;
  return null;
}

// Pairs each flagged hop with what it was resubmitted as (the next hop, or the
// task's current answer for the last one) so the page can render "from -> to"
// directly.
function buildResubmissionTransitions(
  latest: RawResponseEntry,
  responseType: RawTaskItem['responseType'],
): HistoryResubmissionTransition[] {
  const chain = latest.resubmissionHistory;
  return chain.map((hop, index) => {
    const next = index + 1 < chain.length ? chain[index + 1] : latest;
    return {
      kind: 'FLAG_RESUBMIT' as const,
      fromValue: formatRawValue(hop, responseType),
      toValue: formatRawValue(next, responseType),
      flagReason: hop.flagReason,
      flaggedByName: hop.flaggedByName,
      flaggedAt: hop.flaggedAt ? formatTimeLabel(hop.flaggedAt) : null,
      resubmittedByName: next.employeeFullName,
      resubmittedAt: formatTimeLabel(next.respondedAt),
    };
  });
}

// The owner's latest DIRECT value-edit on the current response, if any --
// distinct from the flag -> resubmit chain above (that's a different response
// row each time; this is the same row edited in place). Only 'DIRECT' entries
// qualify: a 'FLAG_TO_EMPLOYEE' correction on the current (active, unflagged)
// response would be stale leftover metadata from before it was superseded, and
// is already covered by the resubmission chain instead.
function buildDirectCorrectionTransition(
  latest: RawResponseEntry,
  responseType: RawTaskItem['responseType'],
): HistoryResubmissionTransition | null {
  const correction = latest.latestCorrection;
  if (!correction || correction.correctionType !== 'DIRECT') return null;
  return {
    kind: 'DIRECT_CORRECTION',
    fromValue: formatRawValue(
      { booleanValue: correction.originalValueBoolean, numericValue: correction.originalValueNumeric, textValue: correction.originalValueText },
      responseType,
    ),
    toValue: formatRawValue(
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

function toHistoryTask(task: RawTaskItem): HistoryTaskDetail {
  const latest = latestResponse(task.responses);
  const directCorrection = latest ? buildDirectCorrectionTransition(latest, task.responseType) : null;
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
    status: deriveTaskStatus(task, latest),
    responseValue: latest ? formatRawValue(latest, task.responseType) : null,
    completedBy: latest ? { employeeUserId: latest.employeeUserId, name: latest.employeeFullName } : null,
    completedAt: latest ? formatTimeLabel(latest.respondedAt) : null,
    completedByAll,
    resubmissionHistory: latest
      ? [...buildResubmissionTransitions(latest, task.responseType), ...(directCorrection ? [directCorrection] : [])]
      : [],
  };
}

function toHistoryCategory(category: RawCategory): HistoryCategoryEntry {
  const tasks = category.tasks.map(toHistoryTask);
  return {
    id: category.id,
    name: category.name,
    tasksCompleted: tasks.filter((task) => task.status !== 'NOT_ANSWERED').length,
    tasksTotal: tasks.length,
    tasks,
  };
}

function toHistoryIssue(issue: RawIssue): HistoryIssueEntry {
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

export async function getShiftHistory(storeId: number, date: string): Promise<ShiftHistory> {
  const query = new URLSearchParams({ storeId: String(storeId), date });
  const response = await fetchWithTimeout(`${API_BASE_URL}/me/history/detail?${query}`, {
    headers: authHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to load history'));
  }

  const raw: RawDetail = await response.json();
  return {
    date: raw.date,
    storeId: raw.storeId,
    hasChecklist: raw.hasChecklist,
    categories: raw.categories.map(toHistoryCategory),
    issues: (raw.issues ?? []).map(toHistoryIssue),
  };
}
