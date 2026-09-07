import { useCallback, useEffect, useRef, useState } from 'react';
import { getAuthorizedStores } from '../api/stores';
import type { StoreSummary } from '../types/store';

interface AssignedStores {
  stores: StoreSummary[];
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the stores the signed-in user may work in. Fetched once per session and
 * shared, so the picker, the shell and the history filter all read one list
 * rather than each fetching their own -- `reload()` re-fetches on demand (e.g.
 * every time the store picker screen is shown), so a store the signed-in user
 * was unassigned from mid-session doesn't linger.
 *
 * Pass `enabled: false` for roles that never pick a store, so no request is made.
 */
export function useAssignedStores(enabled: boolean): AssignedStores {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // Only the very first fetch should show the full-page loading state; a
  // background reload (e.g. the store picker re-fetching on mount) must not
  // flip isLoading back to true, or the screen reading it would unmount and
  // remount the very component that triggered the reload, looping forever.
  const hasLoadedOnce = useRef(false);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!enabled) {
      setStores([]);
      setIsLoading(false);
      setError(null);
      hasLoadedOnce.current = false;
      return;
    }

    let active = true;
    const isBackgroundReload = hasLoadedOnce.current;
    if (!isBackgroundReload) setIsLoading(true);
    setError(null);

    getAuthorizedStores()
      .then((result) => {
        if (active) setStores(result);
      })
      .catch((cause: unknown) => {
        // A 401 is already handled globally by sessionManager, which ends the
        // session; anything else surfaces here so the user is not left staring
        // at an empty screen.
        if (active) setError(cause instanceof Error ? cause.message : 'Failed to load your stores');
      })
      .finally(() => {
        if (active) {
          hasLoadedOnce.current = true;
          if (!isBackgroundReload) setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [enabled, reloadToken]);

  return { stores, isLoading, error, reload };
}
