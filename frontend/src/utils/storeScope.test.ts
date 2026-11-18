import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authHeaders, clearOwnerStoreId, setAuthToken, setOwnerStoreId } from './authStorage';
import { onStoreScopeInvalid, reportIfStoreScopeInvalid } from './storeScope';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('owner store header', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('carries the selected Owner/Admin store on every request', () => {
    setAuthToken('t', false);
    expect(authHeaders()).toEqual({ Authorization: 'Bearer t' });

    setOwnerStoreId(42);
    expect(authHeaders()).toEqual({ Authorization: 'Bearer t', 'X-Store-Id': '42' });

    clearOwnerStoreId();
    expect(authHeaders()['X-Store-Id']).toBeUndefined();
  });
});

describe('reportIfStoreScopeInvalid', () => {
  let handler: ReturnType<typeof vi.fn<() => void>>;
  let stop: () => void;

  beforeEach(() => {
    handler = vi.fn<() => void>();
    stop = onStoreScopeInvalid(handler);
  });

  afterEach(() => stop());

  it('signals a 404 whose code says the selected store is no longer usable', async () => {
    reportIfStoreScopeInvalid(jsonResponse(404, { message: 'Store not found', code: 'STORE_SCOPE_INVALID' }));
    await vi.waitFor(() => expect(handler).toHaveBeenCalledTimes(1));
  });

  it('ignores an ordinary 404 and other statuses', async () => {
    reportIfStoreScopeInvalid(jsonResponse(404, { message: 'Task not found' }));
    reportIfStoreScopeInvalid(jsonResponse(409, { message: 'Conflict', code: 'STORE_SCOPE_INVALID' }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(handler).not.toHaveBeenCalled();
  });
});
