import { apiRequest } from './client';
import type { ActivityLogEntry } from '../types/activity';

// Shared by both roles: Owner Admin gets activity scoped to their own
// store(s), Super Admin gets every store platform-wide.
export async function getRecentActivity(limit = 20): Promise<ActivityLogEntry[]> {
  return apiRequest<ActivityLogEntry[]>(`/activity?limit=${limit}`);
}
