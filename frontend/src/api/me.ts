import { apiRequest } from './client';
import type { Role } from '../types/auth';

export interface MeResponse {
  id: number;
  fullName: string;
  email: string;
  role: Role;
  storeNames: string[];
  mustResetPassword: boolean;
  // Employee-only details for the Profile page; null for owners/super admins.
  shift: string | null;
  employeeType: string | null;
  phone: string | null;
  // Base64 data URL or null when not set.
  avatarUrl: string | null;
}

export interface UpdateMePayload {
  fullName: string;
  email: string;
  phone?: string | null;
}

export async function getMe(): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me');
}

// Self-service profile edit -- returns the updated record so the caller can
// refresh its display immediately, without a second round trip.
export async function updateMe(payload: UpdateMePayload): Promise<MeResponse> {
  return apiRequest<MeResponse>('/me', { method: 'PUT', body: payload });
}

// Upload or remove profile avatar. Pass null to clear.
export async function updateAvatar(avatarUrl: string | null): Promise<void> {
  return apiRequest<void>('/me/avatar', { method: 'PATCH', body: { avatarUrl } });
}
