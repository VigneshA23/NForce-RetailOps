import { apiRequest } from './client';
import type { MonthlyCashSummary } from '../types/cashSummary';

// Owner/Admin: month-end cash summary for their own store (resolved server-side).
export function getMonthlyCashSummary(month: string, signal?: AbortSignal): Promise<MonthlyCashSummary> {
  return apiRequest<MonthlyCashSummary>(`/stores/cash/monthly-summary?month=${encodeURIComponent(month)}`, { signal });
}

// Super Admin: one named store, or every active store (plus any that traded
// that month) and a Combined total when no storeId is provided.
export function getSuperAdminMonthlyCashSummary(
  month: string,
  signal?: AbortSignal,
  storeId?: number,
): Promise<MonthlyCashSummary> {
  const params = new URLSearchParams({ month });
  if (storeId !== undefined) params.set('storeIds', String(storeId));
  return apiRequest<MonthlyCashSummary>(`/super-admin/cash/monthly-summary?${params}`, { signal });
}
