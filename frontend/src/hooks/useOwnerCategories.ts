import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { getCategories } from '../api/categories';
import type { Category } from '../types/category';

interface OwnerCategoriesState {
  categories: Category[];
  setCategories: Dispatch<SetStateAction<Category[]>>;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads the owner's categories. Fetched once per DashboardShell session and
 * shared, so Home, Categories and Tasks all read one list rather than each
 * fetching their own on every tab switch.
 */
export function useOwnerCategories(): OwnerCategoriesState {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setError(null);

    getCategories()
      .then((result) => {
        if (active) setCategories(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Failed to load categories');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [reloadToken]);

  return { categories, setCategories, isLoading, error, reload };
}
