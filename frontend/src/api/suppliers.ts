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

// Owner/Admin's Suppliers tab: rename and activate/deactivate through the
// owner-scoped endpoints (the Super Admin ones above are role-gated).
export async function updateOwnerSupplier(id: number, values: SupplierFormValues): Promise<Supplier> {
  return apiRequest<Supplier>(`/stores/suppliers/${id}`, { method: 'PUT', body: values });
}

export async function setOwnerSupplierActive(id: number, active: boolean): Promise<Supplier> {
  return apiRequest<Supplier>(`/stores/suppliers/${id}/status`, { method: 'PATCH', body: { active } });
}
