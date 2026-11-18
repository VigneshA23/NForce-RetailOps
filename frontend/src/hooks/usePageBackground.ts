import { useEffect, useState } from 'react';

export type PageBackground = 'blue' | 'pink';

export const PAGE_BACKGROUND_OPTIONS: { value: PageBackground; label: string }[] = [
  { value: 'blue', label: 'Blue waves' },
  { value: 'pink', label: 'Pink waves' },
];

const BACKGROUND_STORAGE_KEY = 'nforce-retailops-background';
// Keeps every useBackground() copy in sync, as useTheme does.
const BACKGROUND_CHANGE_EVENT = 'nforce-retailops-background-change';

function readStoredBackground(): PageBackground {
  try {
    return window.localStorage.getItem(BACKGROUND_STORAGE_KEY) === 'pink' ? 'pink' : 'blue';
  } catch {
    return 'blue';
  }
}

/** Sets <html data-bg> from storage. Called once at startup (main.tsx) so the
 *  chosen background shows on every page, not only after Profile mounts. */
export function applyStoredBackground() {
  document.documentElement.dataset.bg = readStoredBackground();
}

export function usePageBackground() {
  const [background, setBackgroundState] = useState<PageBackground>(readStoredBackground);

  useEffect(() => {
    function sync() {
      setBackgroundState(readStoredBackground());
    }
    window.addEventListener(BACKGROUND_CHANGE_EVENT, sync);
    return () => window.removeEventListener(BACKGROUND_CHANGE_EVENT, sync);
  }, []);

  function setBackground(next: PageBackground) {
    try {
      window.localStorage.setItem(BACKGROUND_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice still applies for this visit.
    }
    document.documentElement.dataset.bg = next;
    setBackgroundState(next);
    window.dispatchEvent(new Event(BACKGROUND_CHANGE_EVENT));
  }

  return { background, setBackground };
}
