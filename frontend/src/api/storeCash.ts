import { ApiError, apiRequest } from './client';
import type {
  CashHistory,
  CashHistoryStatusFilter,
  DailyCashEntry,
  DailyCashEntryRequest,
  ExpectedCashAsOf,
} from '../types/storeCash';

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

// Expected cash on hand as of a date (the server's running sum from the
// store's first entry), even when that day has no entry.
export async function getExpectedCashAsOf(date: string, signal?: AbortSignal): Promise<ExpectedCashAsOf> {
  return apiRequest<ExpectedCashAsOf>(`/stores/cash/expected-as-of?date=${date}`, { signal });
}

export async function getSuperAdminExpectedCashAsOf(
  storeId: number,
  date: string,
  signal?: AbortSignal,
): Promise<ExpectedCashAsOf> {
  return apiRequest<ExpectedCashAsOf>(`/super-admin/stores/${storeId}/cash/expected-as-of?date=${date}`, { signal });
}

// Owner/Admin flags an entry in their own store; the entering employee is told.
export async function flagCashEntry(entryId: number, comment: string): Promise<DailyCashEntry> {
  return apiRequest<DailyCashEntry>(`/stores/cash/entries/${entryId}/flag`, { method: 'POST', body: { comment } });
}

export async function editCashFlag(entryId: number, comment: string): Promise<DailyCashEntry> {
  return apiRequest<DailyCashEntry>(`/stores/cash/entries/${entryId}/flag`, { method: 'PATCH', body: { comment } });
}

export async function removeCashFlag(entryId: number): Promise<DailyCashEntry> {
  return apiRequest<DailyCashEntry>(`/stores/cash/entries/${entryId}/flag`, { method: 'DELETE' });
}

// Super Admin flags an entry in any store; the entering employee is told.
export async function flagSuperAdminCashEntry(storeId: number, entryId: number, comment: string): Promise<DailyCashEntry> {
  return apiRequest<DailyCashEntry>(`/super-admin/stores/${storeId}/cash/entries/${entryId}/flag`, {
    method: 'POST', body: { comment },
  });
}

export async function editSuperAdminCashFlag(storeId: number, entryId: number, comment: string): Promise<DailyCashEntry> {
  return apiRequest<DailyCashEntry>(`/super-admin/stores/${storeId}/cash/entries/${entryId}/flag`, {
    method: 'PATCH', body: { comment },
  });
}

export async function removeSuperAdminCashFlag(storeId: number, entryId: number): Promise<DailyCashEntry> {
  return apiRequest<DailyCashEntry>(`/super-admin/stores/${storeId}/cash/entries/${entryId}/flag`, { method: 'DELETE' });
}

function historyQuery(from: string, to: string, status: CashHistoryStatusFilter): string {
  const params = new URLSearchParams({ from, to });
  if (status !== 'ALL') params.set('status', status);
  return params.toString();
}

export async function getCashHistory(
  from: string,
  to: string,
  status: CashHistoryStatusFilter,
  signal?: AbortSignal,
): Promise<CashHistory> {
  return apiRequest<CashHistory>(`/stores/cash/history?${historyQuery(from, to, status)}`, { signal });
}

export async function getSuperAdminCashHistory(
  storeId: number,
  from: string,
  to: string,
  status: CashHistoryStatusFilter,
  signal?: AbortSignal,
): Promise<CashHistory> {
  return apiRequest<CashHistory>(
    `/super-admin/stores/${storeId}/cash/history?${historyQuery(from, to, status)}`,
    { signal },
  );
}
