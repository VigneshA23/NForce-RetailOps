import type { AuthUser } from '../types/auth'
import { authHeaders } from '../utils/authStorage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export interface LoginResult extends AuthUser {
  mustResetPassword: boolean
}

export async function login(email: string, password: string): Promise<LoginResult> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error('Invalid email or password')
  }

  return response.json()
}

export async function completePasswordReset(newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ newPassword }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
      'Unable to reset password. Please try again.'
    throw new Error(message)
  }
}

// Voluntary in-app password change from the Profile page -- unlike
// completePasswordReset above (the forced first-login flow), this verifies the
// caller's current password server-side before allowing a new one.
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ currentPassword, newPassword }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
      'Unable to change password. Please try again.'
    throw new Error(message)
  }
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
  })
}

export interface SessionConfig {
  inactivityTimeoutMinutes: number
}

export async function getSessionConfig(): Promise<SessionConfig> {
  const response = await fetch(`${API_BASE_URL}/auth/session-config`)

  if (!response.ok) {
    throw new Error('Unable to load session configuration')
  }

  return response.json()
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    throw new Error('Unable to send reset instructions')
  }
}
