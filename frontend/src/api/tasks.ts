import { apiRequest } from './client';
import type { ChecklistCategory, TaskResponseType } from '../types/task';

interface TaskChecklistItemResponse {
  id: number;
  name: string;
  responseType: TaskResponseType;
}

interface CategoryChecklistResponse {
  id: number;
  name: string;
  tasks: TaskChecklistItemResponse[];
}

interface TodayChecklistResponse {
  storeId: number;
  date: string;
  categories: CategoryChecklistResponse[];
}

/**
 * Today's checklist for the given store, scoped server-side to the categories
 * and tasks the owner has configured for it -- see GET /api/me/tasks/today.
 * A store the caller isn't assigned to comes back as a 404 (ApiError).
 */
export async function getDailyChecklist(storeId: number): Promise<ChecklistCategory[]> {
  const result = await apiRequest<TodayChecklistResponse>(`/me/tasks/today?storeId=${storeId}`);
  return result.categories;
}

// TODO: replace with a real "raise issue with owner" endpoint once one exists on the backend.
const SIMULATED_LATENCY_MS = 200;

export async function raiseIssue(_storeId: number, _note: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, SIMULATED_LATENCY_MS);
  });
}
