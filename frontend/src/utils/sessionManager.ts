// Centralized, global session-management primitives. This is the ONLY place
// that should own inactivity timing or 401 detection — pages must never wire
// up their own timers or fetch interceptors.

export const DEFAULT_INACTIVITY_TIMEOUT_MINUTES = 30;

const ACTIVITY_EVENTS = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click'] as const;
const ACTIVITY_RESET_THROTTLE_MS = 1000;

/**
 * Starts a single inactivity timer that fires `onTimeout` once `timeoutMs`
 * elapses with no qualifying user activity. Activity resets are throttled so
 * a flood of mousemove events doesn't churn timers on every pixel of motion.
 * Returns a cleanup function that removes all listeners and cancels the timer.
 */
export function startInactivityTimer(timeoutMs: number, onTimeout: () => void): () => void {
  let timer: ReturnType<typeof setTimeout>;
  let lastReset = 0;

  function reset() {
    const now = Date.now();
    if (now - lastReset < ACTIVITY_RESET_THROTTLE_MS) return;
    lastReset = now;
    clearTimeout(timer);
    timer = setTimeout(onTimeout, timeoutMs);
  }

  reset();
  ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, reset, { passive: true }));

  return () => {
    clearTimeout(timer);
    ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, reset));
  };
}

type UnauthorizedListener = () => void;

const unauthorizedListeners = new Set<UnauthorizedListener>();
let fetchPatched = false;

function ensureFetchIsPatched() {
  if (fetchPatched) return;
  fetchPatched = true;

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args: Parameters<typeof fetch>) => {
    const response = await originalFetch(...args);
    if (response.status === 401) {
      unauthorizedListeners.forEach((listener) => listener());
    }
    return response;
  };
}

/**
 * Subscribes to ANY fetch response (from anywhere in the app) that comes back
 * 401 Unauthorized. This is what makes 401 handling global without every
 * api/*.ts call site needing to check for it individually. Deliberately does
 * NOT react to 403 — that means authenticated-but-not-authorized, which must
 * not end the session. Returns an unsubscribe function.
 */
export function onUnauthorizedResponse(listener: UnauthorizedListener): () => void {
  ensureFetchIsPatched();
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}
