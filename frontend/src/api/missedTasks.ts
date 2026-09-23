import { apiRequest } from './client'
import type { MissedTaskMove, MissedTasksPage } from '../types/missedTasks'

/**
 * "Missed Tasks": past-day instances of this store's tasks that were never
 * completed -- see GET /api/me/tasks/missed. Cursor pagination groups whole
 * dates; pass the previous page's `nextCursor` to load older dates.
 */
export async function getMissedTasks(storeId: number, cursor?: string | null, signal?: AbortSignal): Promise<MissedTasksPage> {
  const params = new URLSearchParams({ storeId: String(storeId) })
  if (cursor) params.set('cursor', cursor)
  // Temporarily bumped to 60s (from 30s) to check whether this endpoint's slow
  // responses are a DB/backend issue that just needs more time to complete, or
  // a genuine hang -- revert once that's confirmed.
  return apiRequest<MissedTasksPage>(`/me/tasks/missed?${params.toString()}`, { timeoutMs: 90_000, signal })
}

/**
 * Move a missed instance onto a target date (today, up to 7 days out). The
 * instance then renders on the target date's checklist as its own independent
 * unit -- see POST /api/me/tasks/{taskId}/missed/{date}/move.
 */
export async function moveMissedTask(taskId: number, date: string, storeId: number, targetDate: string): Promise<MissedTaskMove> {
  return apiRequest<MissedTaskMove>(
    `/me/tasks/${taskId}/missed/${date}/move?storeId=${storeId}`,
    { method: 'POST', body: { targetDate } },
  )
}
