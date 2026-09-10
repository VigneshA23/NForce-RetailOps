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

export async function createSupplier(values: SupplierFormValues): Promise<Supplier> {
  return apiRequest<Supplier>('/super-admin/suppliers', { method: 'POST', body: values });
}

export async function updateSupplier(id: number, values: SupplierFormValues): Promise<Supplier> {
  return apiRequest<Supplier>(`/super-admin/suppliers/${id}`, { method: 'PUT', body: values });
}

export async function setSupplierActive(id: number, active: boolean): Promise<Supplier> {
  return apiRequest<Supplier>(`/super-admin/suppliers/${id}/status`, { method: 'PATCH', body: { active } });
}
