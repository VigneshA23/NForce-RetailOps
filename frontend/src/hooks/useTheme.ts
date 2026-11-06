import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

const THEME_STORAGE_KEY = 'nforce-retailops-theme';
// Several components (the app shell header, the Profile page's mobile
// toggle) each call useTheme(); this event keeps their copies in sync.
const THEME_CHANGE_EVENT = 'nforce-retailops-theme-change';

function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
}

export function useTheme() {
  const [isDarkTheme, setIsDarkTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkTheme ? 'dark' : 'light';
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }, [isDarkTheme]);

  useEffect(() => {
    function syncFromStorage() {
      setIsDarkTheme(getInitialTheme());
    }
    window.addEventListener(THEME_CHANGE_EVENT, syncFromStorage);
    return () => window.removeEventListener(THEME_CHANGE_EVENT, syncFromStorage);
  }, []);

  function toggleTheme() {
    const next = !isDarkTheme;
    const doc = document as Document & { startViewTransition?: (update: () => void) => unknown };
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (typeof doc.startViewTransition !== 'function' || reduceMotion) {
      setIsDarkTheme(next);
      return;
    }
    // Snapshot the old theme, flip synchronously, then let the new theme
    // fade in slowly (see the ::view-transition rules in base.css).
    doc.startViewTransition(() => {
      document.documentElement.dataset.theme = next ? 'dark' : 'light';
      flushSync(() => setIsDarkTheme(next));
    });
  }

  return { isDarkTheme, toggleTheme };
}
