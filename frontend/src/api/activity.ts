import { apiRequest } from './client';
import type { ActivityLogEntry } from '../types/activity';

export interface ActivityDateRange {
  startDate: string;
  endDate: string;
}

// Shared by both roles: Owner Admin gets activity scoped to their own
// store(s), Super Admin gets every store platform-wide. range omitted ->
// unfiltered by date (Home dashboard widget usage); supplied -> only that
// inclusive day window (Recent Activity "view all" page's date filter).
export async function getRecentActivity(limit = 20, range?: ActivityDateRange): Promise<ActivityLogEntry[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (range) {
    params.set('startDate', range.startDate);
    params.set('endDate', range.endDate);
  }
  return apiRequest<ActivityLogEntry[]>(`/activity?${params.toString()}`);
}
