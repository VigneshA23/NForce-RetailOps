import { apiRequest } from './client';

export interface MeResponse {
  id: number;
  fullName: string;
  email: string;
  role: 'OWNER_ADMIN' | 'EMPLOYEE';
  storeNames: string[];
}

export async function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me');
}
