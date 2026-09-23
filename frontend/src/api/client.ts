import { authHeaders } from '../utils/authStorage';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api';

const DEFAULT_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// A hung backend request would otherwise leave the caller waiting forever with
// only a loading spinner -- this bounds every request to a fixed worst case.
// An optional external `signal` lets a caller cancel a still-in-flight request
// outright (e.g. a stale fetch superseded by a newer one, or a component that
// unmounted before it resolved) instead of it running to completion unused.
export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
  externalSignal?: AbortSignal,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timeoutId = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (externalSignal) {
    if (externalSignal.aborted) controller.abort();
    else externalSignal.addEventListener('abort', onExternalAbort);
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      if (timedOut) throw new Error('The request timed out. Please check your connection and try again.');
      // Cancelled by the caller (externalSignal), not a timeout -- let callers
      // that care distinguish this via `err.name === 'AbortError'`.
      throw cause;
    }
    throw cause;
  } finally {
    window.clearTimeout(timeoutId);
    externalSignal?.removeEventListener('abort', onExternalAbort);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, { method = 'GET', body, timeoutMs, signal }: RequestOptions = {}): Promise<T> {
  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders(),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  }, timeoutMs, signal);

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const message =
      (payload && typeof payload === 'object' && 'message' in payload && String(payload.message)) ||
      'Something went wrong. Please try again.';
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}
