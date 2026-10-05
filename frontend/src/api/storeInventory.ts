import { apiRequest } from './client';
import type {
  InventoryCountHistoryEntry,
  InventoryCountsPage,
  InventoryItemCategory,
  StoreInventoryItem,
  StoreInventoryItemFormValues,
} from '../types/storeInventory';
import type {
  EodSupplierReport,
  StockCheckHistoryPage,
  StockCheckResponse,
  StockCheckSnapshotKey,
} from '../types/stockCheck';

// Owner/Admin's own-store inventory management, scoped to their own store.
function toBody(values: StoreInventoryItemFormValues) {
  return {
    name: values.name,
    category: values.category,
    unitOfMeasurement: values.unitOfMeasurement,
    minWeekday: values.minWeekday.trim() === '' ? null : Number(values.minWeekday),
    minWeekend: values.minWeekend.trim() === '' ? null : Number(values.minWeekend),
    preferredSupplierId: values.preferredSupplierId,
    note: values.note.trim() === '' ? null : values.note.trim(),
    autoPoEnabled: values.autoPoEnabled,
  };
}

export async function getStoreInventoryItems(): Promise<StoreInventoryItem[]> {
  return apiRequest<StoreInventoryItem[]>('/stores/inventory');
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

export async function correctStockCheck(
  id: number,
  snapshot: StockCheckSnapshotKey,
  available: number,
  deadStock: number,
  reason?: string,
): Promise<StockCheckResponse> {
  return apiRequest<StockCheckResponse>(`/stores/inventory/stock-checks/${id}`, {
    method: 'PATCH',
    body: { snapshot, available, deadStock, reason: reason?.trim() || null },
  });
}

// End of Day supplier report for one business day (YYYY-MM-DD).
export async function getEodSupplierReport(date: string): Promise<EodSupplierReport> {
  return apiRequest<EodSupplierReport>(`/stores/inventory/eod-report?date=${encodeURIComponent(date)}`);
}

export interface InventoryCountsParams {
  search?: string;
  category?: InventoryItemCategory;
  level?: string;
  page?: number;
  size?: number;
}

// Live per-item stock status for the Inventory Counts tab (page is
// 1-indexed, matching Pagination.tsx).
export async function getInventoryCounts(params: InventoryCountsParams = {}): Promise<InventoryCountsPage> {
  const query = new URLSearchParams();
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (params.level) query.set('level', params.level);
  if (params.page) query.set('page', String(params.page));
  if (params.size) query.set('size', String(params.size));
  const qs = query.toString();
  return apiRequest<InventoryCountsPage>(`/stores/inventory/counts${qs ? `?${qs}` : ''}`);
}

// Newest-first count-history timeline for one Inventory Counts row.
export async function getInventoryCountHistory(itemId: number): Promise<InventoryCountHistoryEntry[]> {
  return apiRequest<InventoryCountHistoryEntry[]>(`/stores/inventory/counts/${itemId}/history`);
}
