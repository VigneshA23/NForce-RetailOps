import { useCallback, useEffect, useState } from 'react';
import { getUnreadCount } from '../api/notifications';

const POLL_INTERVAL_MS = 30_000;

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
    return () => window.clearInterval(id);
  }, [fetch]);

  return { count, refresh: fetch, setCount };
}
