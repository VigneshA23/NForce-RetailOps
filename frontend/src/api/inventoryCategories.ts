import { apiRequest } from './client';
import type { InventoryCategory, InventoryCategoryFormValues } from '../types/inventory';

// Super Admin's global inventory category catalog.
export async function getInventoryCategories(): Promise<InventoryCategory[]> {
  return apiRequest<InventoryCategory[]>('/super-admin/inventory/categories');
}

export async function createInventoryCategory(values: InventoryCategoryFormValues): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>('/super-admin/inventory/categories', { method: 'POST', body: values });
}

export async function updateInventoryCategory(id: number, values: InventoryCategoryFormValues): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>(`/super-admin/inventory/categories/${id}`, { method: 'PUT', body: values });
}

export async function setInventoryCategoryActive(id: number, active: boolean): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>(`/super-admin/inventory/categories/${id}/status`, { method: 'PATCH', body: { active } });
}
