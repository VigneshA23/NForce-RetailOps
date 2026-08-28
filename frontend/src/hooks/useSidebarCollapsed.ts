import { useEffect, useState } from 'react';

const SIDEBAR_STORAGE_KEY = 'nforce-retailops-sidebar-collapsed';

function getInitialCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(getInitialCollapsed);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(collapsed));
  }, [collapsed]);

  return [collapsed, setCollapsed] as const;
}
