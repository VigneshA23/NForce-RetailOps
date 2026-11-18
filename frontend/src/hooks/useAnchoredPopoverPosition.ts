import { useLayoutEffect, useState, type DependencyList, type RefObject } from 'react';

const VIEWPORT_MARGIN = 8;

interface PopoverPosition {
  top: number;
  left: number;
}

// Places a fixed, portaled popover panel next to its trigger: below it, or
// above when there is no room below; left-aligned with the trigger, or
// right-aligned when that would run past the right edge; always clamped inside
// the viewport. Shared by CalendarPopover and MonthPickerPopover so the date
// and month pickers open in exactly the same place.
function useAnchoredPopoverPosition(
  isOpen: boolean,
  anchorRef: RefObject<HTMLElement>,
  panelRef: RefObject<HTMLElement>,
  // Anything that changes the panel's size (e.g. the month being viewed).
  deps: DependencyList = [],
): PopoverPosition {
  const [position, setPosition] = useState<PopoverPosition>({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!isOpen) return;
    const anchor = anchorRef.current;
    const panel = panelRef.current;
    if (!anchor || !panel) return;

    const anchorRect = anchor.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();

    let top = anchorRect.bottom + 8;
    if (top + panelRect.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = anchorRect.top - panelRect.height - 8;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    // Left-align with the trigger by default (the panel grows rightward) and
    // only right-align when that would push it past the right edge, so a
    // trigger next to the sidebar never has the panel overlap the sidebar.
    let left = anchorRect.left;
    if (left + panelRect.width > window.innerWidth - VIEWPORT_MARGIN) {
      left = anchorRect.right - panelRect.width;
    }
    left = Math.min(left, window.innerWidth - panelRect.width - VIEWPORT_MARGIN);
    left = Math.max(VIEWPORT_MARGIN, left);

    setPosition((current) => (current.top === top && current.left === left ? current : { top, left }));
  }, [isOpen, anchorRef, panelRef, ...deps]);

  return position;
}

export default useAnchoredPopoverPosition;
