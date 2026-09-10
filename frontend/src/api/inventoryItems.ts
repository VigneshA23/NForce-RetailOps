import { apiRequest } from './client';
import type { InventoryItem, InventoryItemFormValues } from '../types/inventory';
import type { StoreInventoryItem } from '../types/storeInventory';

// Super Admin's global inventory item catalog, plus assigning items to stores.
export async function getInventoryItems(): Promise<InventoryItem[]> {
  return apiRequest<InventoryItem[]>('/super-admin/inventory/items');
}

export async function createInventoryItem(values: InventoryItemFormValues): Promise<InventoryItem> {
  return apiRequest<InventoryItem>('/super-admin/inventory/items', { method: 'POST', body: values });
}

export async function updateInventoryItem(id: number, values: InventoryItemFormValues): Promise<InventoryItem> {
  return apiRequest<InventoryItem>(`/super-admin/inventory/items/${id}`, { method: 'PUT', body: values });
}

export async function setInventoryItemActive(id: number, active: boolean): Promise<InventoryItem> {
  return apiRequest<InventoryItem>(`/super-admin/inventory/items/${id}/status`, { method: 'PATCH', body: { active } });
}

export async function getStoreAssignments(storeId: number): Promise<StoreInventoryItem[]> {
  return apiRequest<StoreInventoryItem[]>(`/super-admin/inventory/stores/${storeId}/assignments`);
}

export async function assignItemToStore(storeId: number, inventoryItemId: number): Promise<StoreInventoryItem> {
  return apiRequest<StoreInventoryItem>('/super-admin/inventory/assign', {
    method: 'POST',
    body: { storeId, inventoryItemId },
  });
}
