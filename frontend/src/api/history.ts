import type { HistoryCategoryEntry, HistoryIssueEntry, HistoryTaskDetail, IssueStatus, ShiftHistory, TaskStatus } from '../types/history';
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
interface RawResponseEntry {
  id: number;
  employeeUserId: number;
  employeeFullName: string;
  empId: string | null;
  booleanValue: boolean | null;
  numericValue: number | null;
  textValue: string | null;
  respondedAt: string;
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

function toHistoryTask(task: RawTaskItem): HistoryTaskDetail {
  const latest = latestResponse(task.responses);
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
    completedBy: latest ? { employeeUserId: latest.employeeUserId, name: latest.employeeFullName } : null,
    completedAt: latest ? formatTimeLabel(latest.respondedAt) : null,
    completedByAll,
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
    issues: raw.issues.map(toHistoryIssue),
  };
}
