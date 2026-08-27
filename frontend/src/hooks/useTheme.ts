import { useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'nforce-retailops-theme';

function getInitialTheme(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(THEME_STORAGE_KEY) === 'dark';
}

export function useTheme() {
  const [isDarkTheme, setIsDarkTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = isDarkTheme ? 'dark' : 'light';
    window.localStorage.setItem(THEME_STORAGE_KEY, isDarkTheme ? 'dark' : 'light');
  }, [isDarkTheme]);

  return { isDarkTheme, toggleTheme: () => setIsDarkTheme((current) => !current) };
}
