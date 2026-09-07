import { apiRequest } from './client';

export interface AdminSearchItem {
  id: number;
  label: string;
  subtitle: string;
}

export interface AdminSearchResponse {
  tasks: AdminSearchItem[];
  categories: AdminSearchItem[];
  employees: AdminSearchItem[];
}

export async function adminSearch(q: string): Promise<AdminSearchResponse> {
  return apiRequest<AdminSearchResponse>(`/search?q=${encodeURIComponent(q)}`);
}
