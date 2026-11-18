import { ApiError, apiRequest } from './client';
import type {
  CashHistory,
  CashHistoryStatusFilter,
  DailyCashEntry,
  DailyCashEntryRequest,
} from '../types/storeCash';

// An employee's Daily Cash for a store they work at. Responses never carry
// expected-cash figures. A date other than today is read-only unless the entry
// was flagged for this employee (the server decides: see `canEdit`).

// The saved entry for the date, or null when none exists (404).
export async function getMyCashEntry(storeId: number, date: string, signal?: AbortSignal): Promise<DailyCashEntry | null> {
  try {
    return await apiRequest<DailyCashEntry>(`/me/cash?storeId=${storeId}&date=${date}`, { signal });
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 404) return null;
    throw cause;
  }
}

// Create or update an entry. `correctionReason` is an optional note here.
export async function saveMyCashEntry(storeId: number, request: DailyCashEntryRequest): Promise<DailyCashEntry> {
  return apiRequest<DailyCashEntry>(`/me/cash?storeId=${storeId}`, { method: 'PUT', body: request });
}

// History of the entries this employee entered.
export async function getMyCashHistory(
  storeId: number,
  from: string,
  to: string,
  status: CashHistoryStatusFilter,
  signal?: AbortSignal,
): Promise<CashHistory> {
  const params = new URLSearchParams({ storeId: String(storeId), from, to });
  if (status !== 'ALL') params.set('status', status);
  return apiRequest<CashHistory>(`/me/cash/history?${params.toString()}`, { signal });
}
