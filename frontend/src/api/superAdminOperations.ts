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

export interface TrendDataPoint {
  date: string;
  completionPercent: number;
}

export async function getPlatformTrend(days: number): Promise<TrendDataPoint[]> {
  return apiRequest<TrendDataPoint[]>(`/super-admin/platform-trend?days=${days}`);
}

export async function getStoreTrend(storeId: number, days: number): Promise<TrendDataPoint[]> {
  return apiRequest<TrendDataPoint[]>(`/super-admin/stores/${storeId}/trend?days=${days}`);
}
