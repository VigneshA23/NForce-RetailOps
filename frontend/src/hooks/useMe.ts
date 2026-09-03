import { useCallback, useEffect, useState } from 'react';
import { getMe, type MeResponse } from '../api/me';

interface MeState {
  me: MeResponse | null;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  setMe: (me: MeResponse) => void;
}

/**
 * Loads the signed-in user's own profile. Fetched once per session and shared,
 * so App's session restore, the Profile page and EmployeeDashboard's Undo check
 * all read one object rather than each fetching their own.
 *
 * Pass `enabled: false` while there is no session to resolve, so no request is
 * made.
 */
export function useMe(enabled: boolean): MeState {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!enabled) {
      setMe(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getMe()
      .then((result) => {
        if (active) setMe(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Failed to load your profile');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, reloadToken]);

  return { me, isLoading, error, reload, setMe };
}
