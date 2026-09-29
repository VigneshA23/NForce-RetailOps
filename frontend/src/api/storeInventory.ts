import { apiRequest } from './client';
import type { StoreInventoryItem, StoreInventoryItemFormValues } from '../types/storeInventory';
import type { InventoryCategory } from '../types/inventory';
import type { StockCheckResponse } from '../types/stockCheck';

// Owner/Admin's own-store inventory management, scoped to their own store.
function toBody(values: StoreInventoryItemFormValues) {
  return {
    name: values.name,
    categoryId: values.categoryId,
    unitOfMeasurement: values.unitOfMeasurement,
    minWeekday: values.minWeekday.trim() === '' ? null : Number(values.minWeekday),
    minWeekend: values.minWeekend.trim() === '' ? null : Number(values.minWeekend),
    preferredSupplierId: values.preferredSupplierId,
    note: values.note.trim() === '' ? null : values.note.trim(),
  };
}

export async function getStoreInventoryItems(): Promise<StoreInventoryItem[]> {
  return apiRequest<StoreInventoryItem[]>('/stores/inventory');
}

export async function getInventoryCategories(): Promise<InventoryCategory[]> {
  return apiRequest<InventoryCategory[]>('/stores/inventory/categories');
}

export async function createStoreInventoryItem(values: StoreInventoryItemFormValues): Promise<StoreInventoryItem> {
  return apiRequest<StoreInventoryItem>('/stores/inventory', { method: 'POST', body: toBody(values) });
}

export async function updateStoreInventoryItem(id: number, values: StoreInventoryItemFormValues): Promise<StoreInventoryItem> {
  return apiRequest<StoreInventoryItem>(`/stores/inventory/${id}`, { method: 'PUT', body: toBody(values) });
}

export async function setStoreInventoryItemActive(id: number, active: boolean): Promise<StoreInventoryItem> {
  return apiRequest<StoreInventoryItem>(`/stores/inventory/${id}/status`, { method: 'PATCH', body: { active } });
}

export async function deleteStoreInventoryItem(id: number): Promise<void> {
  return apiRequest<void>(`/stores/inventory/${id}`, { method: 'DELETE' });
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
