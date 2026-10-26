import { useCallback, useEffect, useState } from 'react';
import { getUnreadCount } from '../api/notifications';

// Short on purpose: this is a single COUNT query, and the bell is how a user
// learns something changed without opening it.
const POLL_INTERVAL_MS = 15_000;

export function useUnreadCount() {
  const [count, setCount] = useState(0);

  const fetch = useCallback(() => {
    getUnreadCount()
      .then(setCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch();
    const id = window.setInterval(fetch, POLL_INTERVAL_MS);
    // Browsers throttle timers in background tabs, so catch up the moment the
    // user comes back instead of waiting for the next tick.
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetch();
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', fetch);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', fetch);
    };
  }, [fetch]);

  return { count, refresh: fetch, setCount };
}
