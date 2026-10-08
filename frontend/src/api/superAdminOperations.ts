import { apiRequest } from './client';
import type { CreateOrderListEntryValues, OrderListEntry, OrderStatus, StoreSupplierPurchaseMetric } from '../types/orderList';
import type { StockCheckSnapshotKey, StockCheckResponse, SuperAdminStockCheckHistoryPage } from '../types/stockCheck';

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

export async function getOutstandingOrders(): Promise<OutstandingOrdersOverview> {
  return apiRequest<OutstandingOrdersOverview>('/super-admin/outstanding-orders');
}

// Drill-down from the overview above into one store's individual order-list
// entries, and the action that moves one through its lifecycle. Unlike the
// Owner/Admin API, Super Admin can act on any store -- the storeId comes from
// the overview row the caller drilled into, not from the caller's own store.
export async function getOrderListForStore(storeId: number): Promise<OrderListEntry[]> {
  return apiRequest<OrderListEntry[]>(`/super-admin/stores/${storeId}/order-list`);
}

export async function updateSuperAdminOrderStatus(storeId: number, entryId: number, status: OrderStatus): Promise<OrderListEntry> {
  return apiRequest<OrderListEntry>(`/super-admin/stores/${storeId}/order-list/${entryId}/status`, {
    method: 'PATCH',
    body: { status },
  });
}

// Super Admin's "Add to order" for a specific store -- counterpart to
// api/orderList.ts's createOrderListEntry, which derives the store from the
// caller's own StoreOwner link. A Super Admin has none, so the store comes
// from the path instead.
export async function createSuperAdminOrderListEntry(storeId: number, values: CreateOrderListEntryValues): Promise<OrderListEntry> {
  return apiRequest<OrderListEntry>(`/super-admin/stores/${storeId}/order-list`, {
    method: 'POST',
    body: {
      storeInventoryItemId: values.storeInventoryItemId,
      itemName: values.itemName.trim() === '' ? null : values.itemName.trim(),
      category: values.category,
      unitOfMeasurement: values.unitOfMeasurement.trim() === '' ? null : values.unitOfMeasurement.trim(),
      saveToInventory: values.saveToInventory,
      minWeekday: values.minWeekday.trim() === '' ? null : Number(values.minWeekday),
      minWeekend: values.minWeekend.trim() === '' ? null : Number(values.minWeekend),
      quantityNeeded: Number(values.quantityNeeded),
      supplierId: values.supplierId,
      note: values.note.trim() === '' ? null : values.note.trim(),
    },
  });
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

// Super Admin's cross-store stock-check history (RTS-305). storeId omitted
// (null) means "every store"; the backend applies a tighter date-range cap
// in that mode than the per-store one.
export async function getSuperAdminStockCheckHistory(
  storeId: number | null,
  startDate: string,
  endDate: string,
  page: number,
  size: number,
): Promise<SuperAdminStockCheckHistoryPage> {
  const params = new URLSearchParams({ startDate, endDate, page: String(page), size: String(size) });
  if (storeId != null) params.set('storeId', String(storeId));
  return apiRequest<SuperAdminStockCheckHistoryPage>(`/super-admin/stock-checks?${params.toString()}`);
}

// Super Admin's cross-store stock-check correction (RTS-306) -- storeId is
// explicit (unlike Owner/Admin's own correctStockCheck in api/storeInventory.ts,
// which is scoped from the caller's own store server-side), and a reason is
// mandatory here, enforced server-side regardless of what the form sends.
export async function correctSuperAdminStockCheck(
  storeId: number,
  id: number,
  snapshot: StockCheckSnapshotKey,
  available: number,
  deadStock: number,
  reason: string,
): Promise<StockCheckResponse> {
  return apiRequest<StockCheckResponse>(`/super-admin/stores/${storeId}/stock-checks/${id}`, {
    method: 'PATCH',
    body: { snapshot, available, deadStock, reason },
  });
}
