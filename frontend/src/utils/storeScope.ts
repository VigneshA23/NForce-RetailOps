// The backend answers 404 with this code when an Owner/Admin's selected store
// (the X-Store-Id header) is no longer one they are actively linked to, e.g. a
// Super Admin unassigned them mid-session. It is broadcast as a window event so
// App can send the admin back to the store picker from wherever the request
// was made, without every page having to recognise it.
export const STORE_SCOPE_INVALID_CODE = 'STORE_SCOPE_INVALID';
export const STORE_SCOPE_INVALID_EVENT = 'nforce:store-scope-invalid';

export function onStoreScopeInvalid(handler: () => void): () => void {
  window.addEventListener(STORE_SCOPE_INVALID_EVENT, handler);
  return () => window.removeEventListener(STORE_SCOPE_INVALID_EVENT, handler);
}

// Reads a copy of the body so the caller's own error handling still gets it.
export function reportIfStoreScopeInvalid(response: Response): void {
  if (response.status !== 404 || typeof response.clone !== 'function') return;
  response
    .clone()
    .json()
    .then((body: unknown) => {
      if (body && typeof body === 'object' && (body as { code?: unknown }).code === STORE_SCOPE_INVALID_CODE) {
        window.dispatchEvent(new Event(STORE_SCOPE_INVALID_EVENT));
      }
    })
    .catch(() => {});
}
