import { apiRequest } from './client';

export interface SASearchItem {
  id: number;
  label: string;
  subtitle: string;
  navTarget: string;
}

export interface SASearchResponse {
  owners: SASearchItem[];
  stores: SASearchItem[];
  employees: SASearchItem[];
}

export async function superAdminSearch(q: string): Promise<SASearchResponse> {
  return apiRequest<SASearchResponse>(`/super-admin/search?q=${encodeURIComponent(q)}`);
}
