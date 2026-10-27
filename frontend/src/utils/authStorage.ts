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

// This tab's own sessionStorage token wins over the shared localStorage one.
// sessionStorage is per tab, so a tab that signed in without "Remember me"
// keeps its own account even after another tab signs in as someone else with
// "Remember me" ticked -- otherwise it would silently start sending that
// other account's token.
export function getAuthToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY) ?? localStorage.getItem(TOKEN_KEY);
}

// Clears only this tab's token. The shared localStorage copy is removed only
// when it is this tab's own; if it belongs to another account signed in from
// another tab, logging out here must not log that tab out too.
export function clearAuthToken(): void {
  const own = getAuthToken();
  sessionStorage.removeItem(TOKEN_KEY);
  if (own !== null && localStorage.getItem(TOKEN_KEY) === own) {
    localStorage.removeItem(TOKEN_KEY);
  }
}

// Derives whether the current session was started with "Remember me" from
// which storage actually holds the token, rather than persisting that choice
// separately -- there is exactly one source of truth for it (the storage
// location itself), so a second copy could never drift out of sync with it.
// A token in this tab's sessionStorage means it was not remembered, even if
// another tab has since put a remembered one in localStorage.
export function wasRememberedLogin(): boolean {
  return sessionStorage.getItem(TOKEN_KEY) === null && localStorage.getItem(TOKEN_KEY) !== null;
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

const AVATAR_KEY = 'nforce-retailops-avatar-url';

// The cached avatar is shared by every tab, so it is tagged with a hash of the
// token it was saved under and only returned to that same session. A tab that
// signs in as a different account must never start with someone else's photo.
// A hash rather than the token itself, so a non-remembered token is never
// copied into storage that outlives the tab.
function tokenFingerprint(token: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < token.length; i++) {
    hash ^= token.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16);
}

export function setStoredAvatarUrl(url: string | null): void {
  const token = getAuthToken();
  if (url === null || token === null) {
    localStorage.removeItem(AVATAR_KEY);
  } else {
    localStorage.setItem(AVATAR_KEY, JSON.stringify({ owner: tokenFingerprint(token), url }));
  }
}

export function getStoredAvatarUrl(): string | null {
  const token = getAuthToken();
  const raw = localStorage.getItem(AVATAR_KEY);
  if (token === null || raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as { owner?: unknown; url?: unknown };
    return parsed.owner === tokenFingerprint(token) && typeof parsed.url === 'string' ? parsed.url : null;
  } catch {
    return null;
  }
}

export function clearStoredAvatarUrl(): void {
  localStorage.removeItem(AVATAR_KEY);
}

export function authHeaders(): HeadersInit {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}
