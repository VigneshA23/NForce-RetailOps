import { apiRequest } from './client';
import type { InventoryCategory, InventoryCategoryFormValues } from '../types/inventoryCategory';

export async function getCategories(): Promise<InventoryCategory[]> {
  return apiRequest<InventoryCategory[]>('/super-admin/inventory-categories');
}

// Read-only category directory for the owner-scoped inventory pages, which
// can't call the Super Admin category-management endpoints.
export async function getOwnerCategories(): Promise<InventoryCategory[]> {
  return apiRequest<InventoryCategory[]>('/stores/inventory-categories');
}

// Inline "Add New Category" from the inventory item form (Owner/Admin and
// Super Admin). Returns the existing category if one with the same name
// (case-insensitive) already exists, instead of creating a duplicate.
export async function findOrCreateCategory(name: string): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>('/stores/inventory-categories', { method: 'POST', body: { name } });
}

export async function createCategory(values: InventoryCategoryFormValues): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>('/super-admin/inventory-categories', { method: 'POST', body: values });
}

export async function updateCategory(id: number, values: InventoryCategoryFormValues): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>(`/super-admin/inventory-categories/${id}`, { method: 'PUT', body: values });
}

export async function setCategoryActive(id: number, active: boolean): Promise<InventoryCategory> {
  return apiRequest<InventoryCategory>(`/super-admin/inventory-categories/${id}/status`, { method: 'PATCH', body: { active } });
}
