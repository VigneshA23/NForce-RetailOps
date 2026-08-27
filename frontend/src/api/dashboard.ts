import { apiRequest } from './client';
import type { StoreSummary } from './stores';

interface DashboardSummaryDto {
  totalStores: number;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  stores: StoreSummary[];
}

export interface DashboardSummary {
  totalStores: number;
  totalEmployees: number;
  activeEmployees: number;
  inactiveEmployees: number;
  stores: StoreSummary[];
}

export async function getDashboardSummary(token: string): Promise<DashboardSummary> {
  return apiRequest<DashboardSummaryDto>('/dashboard/summary', { token });
}
