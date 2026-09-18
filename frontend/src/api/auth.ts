import type { AuthUser } from '../types/auth'
import { authHeaders } from '../utils/authStorage'
import { fetchWithTimeout } from './client'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export interface LoginResult extends AuthUser {
  mustResetPassword: boolean
  sessionTimeoutMinutes: number
}

const LOGIN_TIMEOUT_MS = 30_000;

async function attemptLogin(email: string, password: string, rememberMe: boolean): Promise<Response> {
  return fetchWithTimeout(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, rememberMe }),
  }, LOGIN_TIMEOUT_MS);
}

export async function login(email: string, password: string, rememberMe: boolean): Promise<LoginResult> {
  let response: Response;
  try {
    response = await attemptLogin(email, password, rememberMe);
  } catch {
    // Network/timeout failure (not a server auth rejection) — retry once silently
    // so Lambda cold starts don't surface a spurious error to the user.
    response = await attemptLogin(email, password, rememberMe);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
      'Invalid email or password'
    throw new Error(message)
  }

  return response.json()
}

export async function completePasswordReset(newPassword: string): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/reset-password`, {
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
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  logoutOtherDevices: boolean = false,
): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ currentPassword, newPassword, logoutOtherDevices }),
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
  await fetchWithTimeout(`${API_BASE_URL}/auth/logout`, {
    method: 'POST',
    headers: authHeaders(),
  })
}

export interface SessionConfig {
  inactivityTimeoutMinutes: number
  rememberMeTimeoutMinutes: number
}

export async function getSessionConfig(): Promise<SessionConfig> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/session-config`)

  if (!response.ok) {
    throw new Error('Unable to load session configuration')
  }

  return response.json()
}

export interface SessionStatus {
  remainingSeconds: number
}

// The caller's own current session's real remaining time -- used only to
// seed an accurate UX countdown (e.g. right after a page refresh), never to
// decide whether a request is allowed.
export async function getSessionStatus(): Promise<SessionStatus> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/session-status`, {
    headers: authHeaders(),
  })

  if (!response.ok) {
    throw new Error('Unable to load session status')
  }

  return response.json()
}

export async function requestPasswordReset(email: string): Promise<void> {
  const response = await fetchWithTimeout(`${API_BASE_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })

  if (!response.ok) {
    throw new Error('Unable to send reset instructions')
  }
}

export async function confirmPasswordReset(token: string, newPassword: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/auth/forgot-password/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, newPassword }),
  })

  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
      'Invalid or expired reset link.'
    throw new Error(message)
  }
}
