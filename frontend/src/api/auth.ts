import type { AuthUser } from '../types/auth'
import { authHeaders } from '../utils/authStorage'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api'

export async function login(email: string, password: string): Promise<AuthUser> {
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
