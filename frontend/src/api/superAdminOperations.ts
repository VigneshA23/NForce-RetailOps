import { apiRequest } from './client';
import type { StoreSupplierPurchaseMetric } from '../types/orderList';

export interface StoreOperationsSummary {
  storeId: number;
  storeName: string;
  storeCode: number;
  storeLocation: string | null;
  ownerName: string;
  ownerAvatarUrl?: string | null;
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
  totalTasksToday: number;
  completedTasksToday: number;
  totalEmployees: number;
  employeesActiveToday: number;
  storesWithOpenIssues: number;
  totalOwners: number;
  ownersLoggedInToday: number;
}

export async function getOperationsOverview(date?: string): Promise<StoreOperationsSummary[]> {
  const params = date ? `?date=${date}` : '';
  return apiRequest<StoreOperationsSummary[]>(`/super-admin/operations-overview${params}`);
}

export async function getPlatformStats(date?: string): Promise<PlatformStats> {
  const params = date ? `?date=${date}` : '';
  return apiRequest<PlatformStats>(`/super-admin/platform-stats${params}`);
}

export interface StoreOutstandingOrdersRow {
  storeId: number;
  storeCode: number;
  storeName: string;
  // "Unassigned" when the store has no active owner link.
  ownerName: string;
  outstandingCount: number;
  oldestOutstandingAt: string;
}

export interface OutstandingOrdersOverview {
  // Platform-wide total, unaffected by the row cap below.
  platformOutstandingCount: number;
  storesWithOutstanding: number;
  truncated: boolean;
  stores: StoreOutstandingOrdersRow[];
}

// Read-only: status changes stay on the owner's Order Dashboard.
export async function getOutstandingOrders(): Promise<OutstandingOrdersOverview> {
  return apiRequest<OutstandingOrdersOverview>('/super-admin/outstanding-orders');
}

// Platform-wide Supplier Purchasing Summary, broken down by store. A genuinely
// new access path -- separate from getOutstandingOrders above, which is a
// different (NEEDS_ORDERING-only) report and is untouched by this one.
export async function getSupplierPurchaseMetrics(fromDate: string, toDate: string): Promise<StoreSupplierPurchaseMetric[]> {
  const params = new URLSearchParams({ fromDate, toDate });
  return apiRequest<StoreSupplierPurchaseMetric[]>(`/super-admin/order-list/supplier-metrics?${params}`);
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
