import { apiRequest } from './client'
import type { MissedTaskLink, MissedTasksPage } from '../types/missedTasks'
import type { TaskResponseSubmitPayload, TaskResponseStateResponse } from './tasks'

/**
 * "Missed Tasks": past-day instances of this store's tasks that were never
 * completed -- see GET /api/me/tasks/missed. Cursor pagination groups whole
 * dates; pass the previous page's `nextCursor` to load older dates.
 */
export async function getMissedTasks(storeId: number, cursor?: string | null, signal?: AbortSignal): Promise<MissedTasksPage> {
  const params = new URLSearchParams({ storeId: String(storeId) })
  if (cursor) params.set('cursor', cursor)
  return apiRequest<MissedTasksPage>(`/me/tasks/missed?${params.toString()}`, { timeoutMs: 30_000, signal })
}

export async function completeMissedTaskNow(
  taskId: number,
  date: string,
  payload: TaskResponseSubmitPayload,
): Promise<TaskResponseStateResponse> {
  return apiRequest<TaskResponseStateResponse>(
    `/me/tasks/${taskId}/missed/${date}/complete-now?storeId=${payload.storeId}`,
    { method: 'POST', body: payload },
  )
}

export async function linkMissedTaskToToday(taskId: number, date: string, storeId: number): Promise<MissedTaskLink> {
  return apiRequest<MissedTaskLink>(
    `/me/tasks/${taskId}/missed/${date}/link-to-today?storeId=${storeId}`,
    { method: 'POST' },
  )
}

export async function unlinkMissedTask(taskId: number, date: string, storeId: number): Promise<void> {
  await apiRequest<void>(`/me/tasks/${taskId}/missed/${date}/link?storeId=${storeId}`, { method: 'DELETE' })
}
