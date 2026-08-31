export const AUTH_TOKEN_STORAGE_KEY = 'nforce-retailops-auth-token';
const TOKEN_KEY = AUTH_TOKEN_STORAGE_KEY;

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export const ACTIVE_STORE_STORAGE_KEY = 'nforce-retailops-active-store';

// Only the id is stored. It is re-validated against the server's list of
// assigned stores on every restore, so a stale or hand-edited value can never
// select a store the employee is not assigned to.
export function setActiveStoreId(storeId: number): void {
  localStorage.setItem(ACTIVE_STORE_STORAGE_KEY, String(storeId));
}

export function getActiveStoreId(): number | null {
  const raw = localStorage.getItem(ACTIVE_STORE_STORAGE_KEY);
  if (raw === null) return null;
  const parsed = Number(raw);
  return Number.isInteger(parsed) ? parsed : null;
}

export function clearActiveStoreId(): void {
  localStorage.removeItem(ACTIVE_STORE_STORAGE_KEY);
}

export function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
