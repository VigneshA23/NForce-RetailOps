import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTH_TOKEN_STORAGE_KEY,
  clearAuthToken,
  getAuthToken,
  getStoredAvatarUrl,
  setAuthToken,
  setStoredAvatarUrl,
  wasRememberedLogin,
} from './authStorage';

// One jsdom window stands in for "this tab"; writes straight to localStorage
// stand in for another tab, which shares localStorage but not sessionStorage.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('auth token with two accounts in two tabs', () => {
  it("keeps this tab's own non-remembered token when another tab stores a remembered one", () => {
    setAuthToken('super-admin-token', false);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'owner-token');

    expect(getAuthToken()).toBe('super-admin-token');
    expect(wasRememberedLogin()).toBe(false);
  });

  it("logging out here leaves another tab's remembered token alone", () => {
    setAuthToken('super-admin-token', false);
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'owner-token');

    clearAuthToken();

    expect(sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe('owner-token');
  });

  it("logging out of a remembered session clears the shared token", () => {
    setAuthToken('owner-token', true);

    clearAuthToken();

    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(getAuthToken()).toBeNull();
  });
});

describe('cached avatar', () => {
  it('is returned to the session that saved it', () => {
    setAuthToken('super-admin-token', true);
    setStoredAvatarUrl('https://img/super-admin.png');

    expect(getStoredAvatarUrl()).toBe('https://img/super-admin.png');
  });

  it('is never shown to a different account signing in', () => {
    setAuthToken('super-admin-token', true);
    setStoredAvatarUrl('https://img/super-admin.png');

    setAuthToken('owner-token', false);

    expect(getStoredAvatarUrl()).toBeNull();
  });

  it('ignores an old-format cached value', () => {
    setAuthToken('owner-token', true);
    localStorage.setItem('nforce-retailops-avatar-url', 'https://img/legacy.png');

    expect(getStoredAvatarUrl()).toBeNull();
  });
});
