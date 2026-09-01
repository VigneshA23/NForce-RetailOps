import { apiRequest } from './client';
import type { Role } from '../types/auth';

export interface MeResponse {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  storeNames: string[];
  mustResetPassword: boolean;
}

export async function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me');
}
