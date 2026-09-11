import { apiRequest } from './client';
import type { StoreInventoryItem, StoreInventoryItemConfigFormValues } from '../types/storeInventory';
import type { StockCheckResponse } from '../types/stockCheck';

// Owner/Admin's store-inventory configuration, scoped to their own store.
export async function getStoreInventoryItems(): Promise<StoreInventoryItem[]> {
  return apiRequest<StoreInventoryItem[]>('/stores/inventory');
}

export async function updateStoreInventoryItemConfig(
  id: number,
  values: StoreInventoryItemConfigFormValues,
): Promise<StoreInventoryItem> {
  return apiRequest<StoreInventoryItem>(`/stores/inventory/${id}`, {
    method: 'PATCH',
    body: {
      minWeekday: values.minWeekday.trim() === '' ? null : Number(values.minWeekday),
      minWeekend: values.minWeekend.trim() === '' ? null : Number(values.minWeekend),
      preferredSupplierId: values.preferredSupplierId,
    },
  });
}

export async function getHistoricalStockChecks(startDate: string, endDate: string): Promise<StockCheckResponse[]> {
  return apiRequest<StockCheckResponse[]>(`/stores/inventory/stock-checks?startDate=${startDate}&endDate=${endDate}`);
}

export async function correctStockCheck(id: number, currentCount: number): Promise<StockCheckResponse> {
  return apiRequest<StockCheckResponse>(`/stores/inventory/stock-checks/${id}`, {
    method: 'PATCH',
    body: { currentCount },
  });
}
