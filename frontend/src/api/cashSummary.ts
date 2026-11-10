import { apiRequest } from './client';
import type { MonthlyCashSummary } from '../types/cashSummary';

// Owner/Admin: month-end cash summary for their own store (resolved server-side).
export function getMonthlyCashSummary(month: string, signal?: AbortSignal): Promise<MonthlyCashSummary> {
  return apiRequest<MonthlyCashSummary>(`/stores/cash/monthly-summary?month=${encodeURIComponent(month)}`, { signal });
}

// Super Admin: every active store (plus any that traded that month) and a
// Combined total.
export function getSuperAdminMonthlyCashSummary(month: string, signal?: AbortSignal): Promise<MonthlyCashSummary> {
  return apiRequest<MonthlyCashSummary>(`/super-admin/cash/monthly-summary?month=${encodeURIComponent(month)}`, { signal });
}
