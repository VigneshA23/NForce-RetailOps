import { apiRequest } from './client';

export interface StoreOperationsSummary {
  storeId: number;
  storeName: string;
  ownerName: string;
  totalTasks: number;
  completedTasks: number;
  completionPercent: number;
  openIssues: number;
  lastActivityAt: string | null;
}

export interface PlatformStats {
  platformCompletionPercent: number;
  totalOpenIssues: number;
  totalStores: number;
  storesWithActivity: number;
}

export async function getOperationsOverview(date?: string): Promise<StoreOperationsSummary[]> {
  const params = date ? `?date=${date}` : '';
  return apiRequest<StoreOperationsSummary[]>(`/super-admin/operations-overview${params}`);
}

export async function getPlatformStats(date?: string): Promise<PlatformStats> {
  const params = date ? `?date=${date}` : '';
  return apiRequest<PlatformStats>(`/super-admin/platform-stats${params}`);
}
