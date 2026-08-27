import { apiRequest } from './client';
import type { OwnerStore } from '../types/ownerStore';

export interface DashboardSummary {
  totalStores: number;
  totalEmployees: number;
  stores: OwnerStore[];
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  return apiRequest<DashboardSummary>('/dashboard/summary');
}
