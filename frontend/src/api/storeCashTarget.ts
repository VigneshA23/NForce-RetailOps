import { apiRequest } from './client';
import type { StoreCashTarget } from '../types/storeCashTarget';

// Read-only cash-drawer target, shown on Daily Cash. Editing lives on the
// store form, not here. The server creates a store's target on first read
// with the default amount, so a read always returns one.

// Owner/Admin: their own store, resolved by the server.
export async function getCashTarget(signal?: AbortSignal): Promise<StoreCashTarget> {
  return apiRequest<StoreCashTarget>('/stores/cash-target', { signal });
}

// Super Admin: any store, named explicitly.
export async function getSuperAdminCashTarget(storeId: number, signal?: AbortSignal): Promise<StoreCashTarget> {
  return apiRequest<StoreCashTarget>(`/super-admin/stores/${storeId}/cash-target`, { signal });
}
