import { ApiError, apiRequest } from './client';
import type { DailyCashEntry, DailyCashEntryRequest } from '../types/storeCash';

// Owner/Admin's daily cash entry for their own store -- the server resolves
// the store from the caller, so no storeId is sent.

// The saved entry for the date, or null when none has been saved yet (the
// server answers 404 for that).
export async function getDailyCashEntry(businessDate: string, signal?: AbortSignal): Promise<DailyCashEntry | null> {
  try {
    return await apiRequest<DailyCashEntry>(`/stores/cash?date=${businessDate}`, { signal });
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}

// Create-or-update: re-saving a date overwrites it, and the server keeps the
// previous values in its correction history.
export async function saveDailyCashEntry(request: DailyCashEntryRequest): Promise<DailyCashEntry> {
  return apiRequest<DailyCashEntry>('/stores/cash', { method: 'PUT', body: request });
}

// Super Admin: the same entry and history for any store, named explicitly.
export async function getSuperAdminDailyCashEntry(
  storeId: number,
  businessDate: string,
  signal?: AbortSignal,
): Promise<DailyCashEntry | null> {
  try {
    return await apiRequest<DailyCashEntry>(`/super-admin/stores/${storeId}/cash?date=${businessDate}`, { signal });
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}

export async function saveSuperAdminDailyCashEntry(storeId: number, request: DailyCashEntryRequest): Promise<DailyCashEntry> {
  return apiRequest<DailyCashEntry>(`/super-admin/stores/${storeId}/cash`, { method: 'PUT', body: request });
}
