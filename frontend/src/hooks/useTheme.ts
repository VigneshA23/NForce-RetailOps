import { useEffect, useState } from 'react';

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

  return { isDarkTheme, toggleTheme: () => setIsDarkTheme((current) => !current) };
}
