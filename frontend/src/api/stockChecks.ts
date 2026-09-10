import { apiRequest } from './client';
import type { DailyStockCheckItem, StockCheckResponse } from '../types/stockCheck';

// Employee-facing: Daily Stock Check screen + ad-hoc shortage reporting.
export async function getTodayStockCheck(storeId: number): Promise<DailyStockCheckItem[]> {
  return apiRequest<DailyStockCheckItem[]>(`/me/inventory?storeId=${storeId}`);
}

export async function submitStockCheck(
  storeId: number,
  storeInventoryItemId: number,
  currentCount: number,
): Promise<StockCheckResponse> {
  return apiRequest<StockCheckResponse>('/me/inventory/stock-checks', {
    method: 'POST',
    body: { storeId, storeInventoryItemId, currentCount },
  });
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
