import { useEffect, useRef, useState } from 'react';

// `ts` makes re-selecting the same issue (search result or notification
// clicked twice) fire again even though issueId hasn't changed.
export interface IssueFocusRequest {
  issueId: number;
  ts: number;
}

const HIGHLIGHT_MS = 2500;
const MAX_SCROLL_FRAMES = 30;

// Scrolls a deep-linked issue card into view and briefly highlights it, once
// that issue is actually present in the loaded list. `clearFilters` runs
// first (given the issue's id, so a paginated page can also jump to the
// page holding it) so a status/store/search filter can't hide the targeted
// card. The card may only render a frame or two later (filters cleared,
// then the page changed), so the scroll retries briefly until it exists.
// Each request is handled once -- later list refreshes (polling) don't
// re-scroll the page out from under the user.
export function useIssueFocus(
  focus: IssueFocusRequest | undefined,
  issueIds: number[],
  idPrefix: string,
  clearFilters: (issueId: number) => void,
): number | null {
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const handledTs = useRef<number | null>(null);
  const clearFiltersRef = useRef(clearFilters);
  clearFiltersRef.current = clearFilters;

  const present = focus !== undefined && issueIds.includes(focus.issueId);

  useEffect(() => {
    if (!focus || !present || handledTs.current === focus.ts) return;
    handledTs.current = focus.ts;
    clearFiltersRef.current(focus.issueId);
    let frame = 0;
    let framesLeft = MAX_SCROLL_FRAMES;
    const tryScroll = () => {
      const card = document.getElementById(`${idPrefix}-${focus.issueId}`);
      if (card) card.scrollIntoView({ block: 'center', behavior: 'smooth' });
      else if (framesLeft-- > 0) frame = window.requestAnimationFrame(tryScroll);
    };
    const scrollTimer = window.setTimeout(() => {
      setHighlightedId(focus.issueId);
      tryScroll();
    }, 0);
    const clearTimer = window.setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
      window.cancelAnimationFrame(frame);
    };
  }, [focus, present, idPrefix]);

  return highlightedId;
}
