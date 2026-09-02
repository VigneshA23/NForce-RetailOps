import { apiRequest } from './client';
import type { ChecklistCategory, TaskResponseSummary } from '../types/task';

/**
 * Today's checklist for the given store, scoped server-side to the categories
 * and tasks the owner has configured for it -- see GET /api/me/tasks/today.
 * A store the caller isn't assigned to comes back as a 404 (ApiError).
 */
export async function getDailyChecklist(storeId: number): Promise<ChecklistCategory[]> {
  const result = await apiRequest<{ storeId: number; date: string; categories: ChecklistCategory[] }>(
    `/me/tasks/today?storeId=${storeId}`,
  );
  return result.categories;
}

// Exactly one of the three value fields is sent, chosen by the task's
// configured responseType -- mirrors TaskResponseSubmitRequest on the backend.
export interface TaskResponseSubmitPayload {
  storeId: number;
  booleanValue?: boolean;
  numericValue?: number;
  textValue?: string;
}

// Returned by both submit and undo: the resulting current state for that
// task/store/day, so the caller doesn't need a second round trip to know
// whether it can still undo -- mirrors TaskResponseStateResponse.
export interface TaskResponseStateResponse {
  taskId: number;
  responses: TaskResponseSummary[];
  canUndo: boolean;
  completedByCount: number;
  totalActiveEmployees: number;
  completedByNames: string[];
}

export async function submitTaskResponse(
  taskId: number,
  payload: TaskResponseSubmitPayload,
): Promise<TaskResponseStateResponse> {
  return apiRequest<TaskResponseStateResponse>(`/me/tasks/${taskId}/responses`, {
    method: 'POST',
    body: payload,
  });
}

export async function undoTaskResponse(
  taskId: number,
  responseId: number,
  storeId: number,
): Promise<TaskResponseStateResponse> {
  return apiRequest<TaskResponseStateResponse>(
    `/me/tasks/${taskId}/responses/${responseId}/undo?storeId=${storeId}`,
    { method: 'POST' },
  );
}

// TODO: replace with a real "raise issue with owner" endpoint once one exists on the backend.
const SIMULATED_LATENCY_MS = 200;

export async function raiseIssue(_storeId: number, _note: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, SIMULATED_LATENCY_MS);
  });
}
