import { apiRequest } from './client';
import type { CreateStoreValues, SuperAdminStore } from '../types/superAdminStore';

// Read-only, cross-owner directory for the Super Admin's Stores page.
export async function getAllStores(): Promise<SuperAdminStore[]> {
  return apiRequest<SuperAdminStore[]>('/stores/all');
}

// Creates a store with no owner -- it later shows up as an "existing store"
// option when a new Owner is created.
export async function createStandaloneStore(values: CreateStoreValues): Promise<SuperAdminStore> {
  return apiRequest<SuperAdminStore>('/stores', { method: 'POST', body: values });
}

// Toggles the store's OWN active/inactive status -- distinct from an owner's
// access to the store (setStoreStatus in api/owners.ts).
export async function updateStoreStatus(id: number, active: boolean): Promise<SuperAdminStore> {
  return apiRequest<SuperAdminStore>(`/stores/${id}/status`, { method: 'PATCH', body: { active } });
}

export async function deleteStore(id: number): Promise<void> {
  return apiRequest<void>(`/stores/${id}`, { method: 'DELETE' });
}
