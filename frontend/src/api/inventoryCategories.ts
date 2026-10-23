import { apiRequest } from './client';
import type {
  InventoryCategoryDeleteResponse,
  InventoryCategoryFormValues,
  InventoryCategoryRecord,
} from '../types/inventoryCategory';

export async function getInventoryCategories(): Promise<InventoryCategoryRecord[]> {
  return apiRequest<InventoryCategoryRecord[]>('/super-admin/inventory-categories');
}

// Owner/Admin's own add/edit item form: only the categories Super Admin has
// assigned to their store.
export async function getOwnerInventoryCategories(): Promise<InventoryCategoryRecord[]> {
  return apiRequest<InventoryCategoryRecord[]>('/stores/inventory-categories');
}

export async function createInventoryCategory(values: InventoryCategoryFormValues): Promise<InventoryCategoryRecord> {
  return apiRequest<InventoryCategoryRecord>('/super-admin/inventory-categories', { method: 'POST', body: values });
}

export async function updateInventoryCategory(id: number, values: InventoryCategoryFormValues): Promise<InventoryCategoryRecord> {
  return apiRequest<InventoryCategoryRecord>(`/super-admin/inventory-categories/${id}`, { method: 'PUT', body: values });
}

export async function setInventoryCategoryActive(id: number, active: boolean): Promise<InventoryCategoryRecord> {
  return apiRequest<InventoryCategoryRecord>(`/super-admin/inventory-categories/${id}/status`, { method: 'PATCH', body: { active } });
}

export async function deleteInventoryCategory(id: number): Promise<InventoryCategoryDeleteResponse> {
  return apiRequest<InventoryCategoryDeleteResponse>(`/super-admin/inventory-categories/${id}`, { method: 'DELETE' });
}
