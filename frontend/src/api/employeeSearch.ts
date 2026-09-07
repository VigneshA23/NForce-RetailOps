import { apiRequest } from './client';

export interface EmployeeSearchItem {
  id: number;
  label: string;
  subtitle: string;
  navTarget: 'today' | 'issues';
}

export interface EmployeeSearchResponse {
  tasks: EmployeeSearchItem[];
  issues: EmployeeSearchItem[];
}

export async function employeeSearch(
  storeId: number,
  q: string,
): Promise<EmployeeSearchResponse> {
  const params = new URLSearchParams({ storeId: String(storeId), q });
  return apiRequest<EmployeeSearchResponse>(`/me/search?${params}`);
}
