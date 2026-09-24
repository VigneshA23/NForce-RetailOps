import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

const POLL_INTERVAL_MS = 60_000;

interface UseIssueListResult<T> {
  issues: T[];
  setIssues: Dispatch<SetStateAction<T[]>>;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

// Shared loader for the three Issues pages. The shells keep visited tabs
// mounted (display:none) so tab switches don't refetch everything -- which
// meant an Issues tab opened from a notification kept showing whatever it
// loaded the first time. This refetches whenever the tab becomes active and
// polls while it stays active, without flashing the loading state again.
//
// `load` must be stable per data source (wrap it in useCallback keyed on e.g.
// storeId); a new `load` resets the list and shows the loading state.
// Pass `null` when there is nothing to load yet (e.g. no store resolved).
export function useIssueList<T>(
  load: (() => Promise<T[]>) | null,
  isActive: boolean,
  errorMessage = 'Could not load issues. Please try again.',
): UseIssueListResult<T> {
  const [issues, setIssues] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(load !== null);
  const [error, setError] = useState<string | null>(null);
  // Guards against an older (slower) response overwriting a newer one, e.g.
  // after a store switch or a poll overlapping a manual retry.
  const requestSeq = useRef(0);
  const hasLoaded = useRef(false);

  const fetchIssues = useCallback((silent: boolean) => {
    if (!load) return;
    const seq = ++requestSeq.current;
    if (!silent) {
      setIsLoading(true);
      setError(null);
    }
    load()
      .then((data) => {
        if (seq !== requestSeq.current) return;
        hasLoaded.current = true;
        setIssues(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (seq !== requestSeq.current) return;
        // A failed background refresh keeps showing the last good list
        // rather than replacing it with an error.
        if (!silent || !hasLoaded.current) {
          setError(err instanceof Error && err.message ? err.message : errorMessage);
        }
      })
      .finally(() => {
        if (seq === requestSeq.current && !silent) setIsLoading(false);
      });
  }, [load, errorMessage]);

  // New data source: start over.
  useEffect(() => {
    hasLoaded.current = false;
    setIssues([]);
    if (!load) {
      requestSeq.current++;
      setIsLoading(false);
      setError(null);
      return;
    }
    fetchIssues(false);
  }, [load, fetchIssues]);

  // Became active again (tab re-opened, overlay closed): refresh silently,
  // then keep polling while it stays active.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (!load || !isActive) {
      wasActive.current = isActive;
      return;
    }
    if (!wasActive.current && hasLoaded.current) fetchIssues(true);
    wasActive.current = true;
    const id = window.setInterval(() => fetchIssues(true), POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [isActive, load, fetchIssues]);

  const refresh = useCallback(() => fetchIssues(false), [fetchIssues]);

  return { issues, setIssues, isLoading, error, refresh };
}
