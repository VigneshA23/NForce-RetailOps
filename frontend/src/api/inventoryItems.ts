import { apiRequest } from './client';
import type { StoreInventoryItem, StoreInventoryItemFormValues } from '../types/storeInventory';

// Super Admin's cross-store inventory management -- full CRUD on any
// store's own inventory items.
function toBody(values: StoreInventoryItemFormValues) {
  return {
    storeId: values.storeId,
    name: values.name,
    unitOfMeasurement: values.unitOfMeasurement,
    minWeekday: values.minWeekday.trim() === '' ? null : Number(values.minWeekday),
    minWeekend: values.minWeekend.trim() === '' ? null : Number(values.minWeekend),
    preferredSupplierId: values.preferredSupplierId,
    note: values.note.trim() === '' ? null : values.note.trim(),
  };
}

export async function getAllInventoryItems(): Promise<StoreInventoryItem[]> {
  return apiRequest<StoreInventoryItem[]>('/super-admin/inventory/items');
}

export async function createInventoryItem(values: StoreInventoryItemFormValues): Promise<StoreInventoryItem> {
  return apiRequest<StoreInventoryItem>('/super-admin/inventory/items', { method: 'POST', body: toBody(values) });
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
