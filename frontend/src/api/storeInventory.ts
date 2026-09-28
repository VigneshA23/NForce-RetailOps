import { apiRequest } from './client';
import type { StoreInventoryItem, StoreInventoryItemConfigFormValues } from '../types/storeInventory';
import type { StockCheckHistoryPage, StockCheckResponse } from '../types/stockCheck';

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

// Owner/Admin's stock-check history, bounded to a date range and paginated
// (page is 1-indexed, matching components/Pagination.tsx).
export async function getStockCheckHistory(
  startDate: string,
  endDate: string,
  page: number,
  size: number,
): Promise<StockCheckHistoryPage> {
  const params = new URLSearchParams({
    startDate,
    endDate,
    page: String(page),
    size: String(size),
  });
  return apiRequest<StockCheckHistoryPage>(`/stores/inventory/stock-checks?${params.toString()}`);
}

export async function correctStockCheck(id: number, currentCount: number): Promise<StockCheckResponse> {
  return apiRequest<StockCheckResponse>(`/stores/inventory/stock-checks/${id}`, {
    method: 'PATCH',
    body: { currentCount },
  });
}
