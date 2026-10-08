import { apiRequest } from './client';
import type { StoreInventoryItem, StoreInventoryItemFormValues } from '../types/storeInventory';

// Super Admin's cross-store inventory management -- full CRUD on any
// store's own inventory items.
function toBody(values: StoreInventoryItemFormValues) {
  return {
    storeId: values.storeId,
    storeIds: values.storeIds ?? [],
    name: values.name,
    category: values.category,
    unitOfMeasurement: values.unitOfMeasurement,
    minWeekday: values.minWeekday.trim() === '' ? null : Number(values.minWeekday),
    minWeekend: values.minWeekend.trim() === '' ? null : Number(values.minWeekend),
    preferredSupplierId: values.preferredSupplierId,
    note: values.note.trim() === '' ? null : values.note.trim(),
    autoPoEnabled: values.autoPoEnabled,
    imagePhotoId: values.imagePhotoId,
    imageUploadData: values.imageUploadData ?? null,
    removeImage: values.removeImage,
  };
}

export async function getAllInventoryItems(): Promise<StoreInventoryItem[]> {
  return apiRequest<StoreInventoryItem[]>('/super-admin/inventory/items');
}

export interface CreateInventoryItemsResult {
  created: StoreInventoryItem[];
  // Selected stores skipped because they already hold an item with the same
  // name and category.
  skippedStoreNames: string[];
}

// One linked copy is created per selected store that doesn't already have it.
export async function createInventoryItem(values: StoreInventoryItemFormValues): Promise<CreateInventoryItemsResult> {
  return apiRequest<CreateInventoryItemsResult>('/super-admin/inventory/items', { method: 'POST', body: toBody(values) });
}

// Categories already used in every one of the given stores.
export async function getCommonCategories(storeIds: number[]): Promise<string[]> {
  return apiRequest<string[]>(`/super-admin/inventory/categories?storeIds=${storeIds.join(',')}`);
}

export async function updateInventoryItem(id: number, values: StoreInventoryItemFormValues): Promise<StoreInventoryItem> {
  return apiRequest<StoreInventoryItem>(`/super-admin/inventory/items/${id}`, { method: 'PUT', body: toBody(values) });
}

export async function setInventoryItemActive(id: number, active: boolean): Promise<StoreInventoryItem> {
  return apiRequest<StoreInventoryItem>(`/super-admin/inventory/items/${id}/status`, { method: 'PATCH', body: { active } });
}

export async function deleteInventoryItem(id: number): Promise<void> {
  return apiRequest<void>(`/super-admin/inventory/items/${id}`, { method: 'DELETE' });
}
