import { useEffect, useRef, type RefObject } from 'react';

interface UseDismissablePanelOptions {
  isOpen: boolean;
  onClose: () => void;
  // Any element considered "inside" the panel — a click/scroll/resize
  // originating within any of these refs is ignored. Typically the trigger
  // button plus the (often portaled) panel itself.
  refs: RefObject<HTMLElement | null>[];
  // Some callers (e.g. ExportMenu, CalendarPopover) don't currently close on
  // Escape / outside scroll — default both on to match the majority pattern
  // (Select/MultiSelect/SearchableSelect/the search dropdowns), but let
  // callers opt out to keep their existing behavior unchanged.
  closeOnEscape?: boolean;
  closeOnScrollOrResize?: boolean;
  // A selector for content that's "inside" the panel logically but not a DOM
  // descendant of any `refs` entry -- e.g. a nested popover (CalendarPopover)
  // that portals straight to document.body. Without this, a click inside it
  // registers as outside and closes the parent panel before the nested
  // popover's own click handler (e.g. selecting a day) can fire.
  ignoreSelector?: string;
}

// Consolidates the outside-pointerdown + Escape + outside-scroll/resize
// dismissal logic that was independently reimplemented across every custom
// dropdown/menu/search-panel component in the app.
function useDismissablePanel({
  isOpen,
  onClose,
  refs,
  closeOnEscape = true,
  closeOnScrollOrResize = true,
  ignoreSelector,
}: UseDismissablePanelOptions) {
  // Read the latest onClose/refs via a ref so the effect below only needs to
  // re-subscribe when `isOpen` (or the opt-out flags) change, same as
  // Modal.tsx's onCloseRef pattern — callers rarely memoize these.
  const latest = useRef({ onClose, refs, ignoreSelector });
  useEffect(() => {
    latest.current = { onClose, refs, ignoreSelector };
  });

  useEffect(() => {
    if (!isOpen) return;

    function isInside(target: Node) {
      if (latest.current.refs.some((ref) => ref.current?.contains(target))) return true;
      const selector = latest.current.ignoreSelector;
      return selector != null && target instanceof Element && target.closest(selector) != null;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!isInside(event.target as Node)) latest.current.onClose();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        latest.current.onClose();
      }
    }

    // Ignore scroll/resize events originating from inside the panel itself —
    // this listener runs on the capture phase on `window`, an ancestor of a
    // portaled panel, so scrolling the panel's own option list would
    // otherwise close it instead of scrolling it.
    function handleScrollOrResize(event: Event) {
      if (isInside(event.target as Node)) return;
      latest.current.onClose();
    }

    document.addEventListener('mousedown', handlePointerDown);
    if (closeOnEscape) document.addEventListener('keydown', handleKeyDown, true);
    if (closeOnScrollOrResize) {
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      if (closeOnEscape) document.removeEventListener('keydown', handleKeyDown, true);
      if (closeOnScrollOrResize) {
        window.removeEventListener('scroll', handleScrollOrResize, true);
        window.removeEventListener('resize', handleScrollOrResize);
      }
    };
  }, [isOpen, closeOnEscape, closeOnScrollOrResize]);
}

export default useDismissablePanel;
