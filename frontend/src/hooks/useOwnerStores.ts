import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getStores } from '../api/ownerStores';
import type { OwnerStore } from '../types/ownerStore';

interface OwnerStoresState {
  stores: OwnerStore[];
  setStores: Dispatch<SetStateAction<OwnerStore[]>>;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the owner's stores. Fetched once per DashboardShell session and
 * shared, so Home, Stores, Tasks and History all read one list rather than
 * each fetching their own on every tab switch.
 */
export function useOwnerStores(): OwnerStoresState {
  const [stores, setStores] = useState<OwnerStore[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    getStores()
      .then((result) => {
        if (active) setStores(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Failed to load stores');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  return { stores, setStores, isLoading, error, reload };
}
