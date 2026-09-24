import { useEffect, useRef, useState } from 'react';

// `ts` makes re-selecting the same issue (search result or notification
// clicked twice) fire again even though issueId hasn't changed.
export interface IssueFocusRequest {
  issueId: number;
  ts: number;
}

const HIGHLIGHT_MS = 2500;

// Scrolls a deep-linked issue card into view and briefly highlights it, once
// that issue is actually present in the loaded list. `clearFilters` runs
// first so a status/store/search filter can't hide the targeted card.
// Each request is handled once -- later list refreshes (polling) don't
// re-scroll the page out from under the user.
export function useIssueFocus(
  focus: IssueFocusRequest | undefined,
  issueIds: number[],
  idPrefix: string,
  clearFilters: () => void,
): number | null {
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const handledTs = useRef<number | null>(null);
  const clearFiltersRef = useRef(clearFilters);
  clearFiltersRef.current = clearFilters;

  const present = focus !== undefined && issueIds.includes(focus.issueId);

  useEffect(() => {
    if (!focus || !present || handledTs.current === focus.ts) return;
    handledTs.current = focus.ts;
    clearFiltersRef.current();
    const scrollTimer = window.setTimeout(() => {
      document.getElementById(`${idPrefix}-${focus.issueId}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setHighlightedId(focus.issueId);
    }, 0);
    const clearTimer = window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focus, present, idPrefix]);

  return highlightedId;
}
