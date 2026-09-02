export const AUTH_TOKEN_STORAGE_KEY = 'nforce-retailops-auth-token';
const TOKEN_KEY = AUTH_TOKEN_STORAGE_KEY;

// "Remember me" controls which storage the token lands in: localStorage
// survives closing the browser, sessionStorage is cleared with the tab. Only
// one is ever populated at a time - switching accounts/logging in again with
// a different choice must not leave a stale token behind in the other one.
export function setAuthToken(token: string, remember: boolean): void {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

const LAST_ROLE_KEY = 'nforce-retailops-last-role';

// The login page's "Need assistance?" note has to be role-specific, but the
// role is only known *after* a successful login/session-restore -- by which
// point the app has already navigated away from the login page. Persisting
// the most recently authenticated role lets the next time this browser shows
// the login page (after a manual logout, or a session expiring) render the
// right message for whoever last used it, without guessing from the email
// being typed. Deliberately never cleared on logout: that's the whole point.
export function setLastKnownRole(role: string): void {
  localStorage.setItem(LAST_ROLE_KEY, role);
}

export function getLastKnownRole(): string | null {
  return localStorage.getItem(LAST_ROLE_KEY);
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
