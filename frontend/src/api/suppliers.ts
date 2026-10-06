import { apiRequest } from './client';
import type { Supplier, SupplierFormValues } from '../types/supplier';

export async function getSuppliers(): Promise<Supplier[]> {
  return apiRequest<Supplier[]>('/super-admin/suppliers');
}

// Read-only supplier directory for the owner-scoped inventory/order pages,
// which can't call the Super Admin supplier-management endpoints.
export async function getOwnerSuppliers(): Promise<Supplier[]> {
  return apiRequest<Supplier[]>('/stores/suppliers');
}

// Inline "Add New Supplier" from the inventory item form (Owner/Admin and
// Super Admin). Returns the existing supplier if one with the same name
// (case-insensitive) already exists, instead of creating a duplicate.
export async function findOrCreateSupplier(name: string): Promise<Supplier> {
  return apiRequest<Supplier>('/stores/suppliers', { method: 'POST', body: { name } });
}

export async function createSupplier(values: SupplierFormValues): Promise<Supplier> {
  return apiRequest<Supplier>('/super-admin/suppliers', { method: 'POST', body: values });
}

export async function updateSupplier(id: number, values: SupplierFormValues): Promise<Supplier> {
  return apiRequest<Supplier>(`/super-admin/suppliers/${id}`, { method: 'PUT', body: values });
}

export async function setSupplierActive(id: number, active: boolean): Promise<Supplier> {
  return apiRequest<Supplier>(`/super-admin/suppliers/${id}/status`, { method: 'PATCH', body: { active } });
}

export interface SupplierDeleteResult {
  deleted: boolean;
  // True when the supplier had order history and was only marked inactive.
  deactivated: boolean;
}

// Permanent delete from the item form's supplier picker (Owner/Admin and
// Super Admin). Items using the supplier fall back to "no preferred supplier".
export async function deleteSupplier(id: number): Promise<SupplierDeleteResult> {
  return apiRequest<SupplierDeleteResult>(`/stores/suppliers/${id}`, { method: 'DELETE' });
}
