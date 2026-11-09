import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiRequest } from './client';

function respondWith(status: number, body: unknown) {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }),
  );
}

async function errorFrom(promise: Promise<unknown>): Promise<ApiError> {
  try {
    await promise;
  } catch (cause) {
    return cause as ApiError;
  }
  throw new Error('expected the request to fail');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('apiRequest errors', () => {
  it('uses the body\'s message and leaves fieldErrors unset', async () => {
    respondWith(409, { message: 'Already updated' });
    const error = await errorFrom(apiRequest('/x'));

    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.message).toBe('Already updated');
    expect(error.fieldErrors).toBeUndefined();
  });

  it('keeps a validation failure\'s field -> message map as fieldErrors', async () => {
    respondWith(400, { totalCashSales: 'Total cash sales is required', cashRemoved: 'Cash removed cannot be negative' });
    const error = await errorFrom(apiRequest('/x'));

    expect(error.status).toBe(400);
    expect(error.message).toBe('Something went wrong. Please try again.');
    expect(error.fieldErrors).toEqual({
      totalCashSales: 'Total cash sales is required',
      cashRemoved: 'Cash removed cannot be negative',
    });
  });
});
