import { apiRequest } from './client';
import type {
  DailyStockCheckItem,
  StockCheckHistoryPage,
  StockCheckResponse,
  StockCheckSnapshotKey,
} from '../types/stockCheck';

// Employee-facing: Daily Stock Check screen + ad-hoc shortage reporting.
export async function getTodayStockCheck(storeId: number): Promise<DailyStockCheckItem[]> {
  return apiRequest<DailyStockCheckItem[]>(`/me/inventory?storeId=${storeId}`);
}

// Saves today's Start of Day or End of Day count; saving the same snapshot
// again updates it in place.
export async function submitStockCheck(
  storeId: number,
  storeInventoryItemId: number,
  snapshot: StockCheckSnapshotKey,
  available: number,
  deadStock: number,
): Promise<StockCheckResponse> {
  return apiRequest<StockCheckResponse>('/me/inventory/stock-checks', {
    method: 'POST',
    body: { storeId, storeInventoryItemId, snapshot, available, deadStock },
  });
}

// Employee-facing mirror of Owner/Admin's stock-check history, scoped to one
// of the caller's own assigned stores.
export async function getEmployeeStockCheckHistory(
  storeId: number,
  startDate: string,
  endDate: string,
  page: number,
  size: number,
): Promise<StockCheckHistoryPage> {
  const params = new URLSearchParams({
    storeId: String(storeId),
    startDate,
    endDate,
    page: String(page),
    size: String(size),
  });
  return apiRequest<StockCheckHistoryPage>(`/me/inventory/stock-checks?${params.toString()}`);
}

export async function reportAdHocShortage(
  storeId: number,
  storeInventoryItemId: number,
  quantity: number,
  note?: string,
): Promise<void> {
  return apiRequest<void>(`/me/inventory/ad-hoc?storeId=${storeId}`, {
    method: 'POST',
    body: { storeInventoryItemId, quantity, note: note?.trim() || null },
  });
}
