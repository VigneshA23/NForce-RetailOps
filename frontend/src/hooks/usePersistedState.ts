import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

// There is no router (see CLAUDE.md), so page-level sub-navigation -- a
// sub-tab, a selected store -- is plain React state and would reset on a
// refresh. This persists it to localStorage (survives
// refresh) under a shared prefix so endSession can wipe all of it at once.
const PREFIX = 'nforce-retailops-page:';

export function clearPersistedPageState(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith(PREFIX)) localStorage.removeItem(key);
    }
  } catch {
    // storage unavailable
  }
}

// `isValid` rejects a stale/renamed stored value so it can never wedge a page.
export function usePersistedState<T>(
  key: string,
  initial: T,
  isValid: (value: unknown) => value is T = (_v): _v is T => true,
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = PREFIX + key;
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const parsed: unknown = JSON.parse(raw);
        if (isValid(parsed)) return parsed;
      }
    } catch {
      // fall through to the default
    }
    return initial;
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // storage unavailable
    }
  }, [storageKey, value]);

  return [value, setValue];
}

export function oneOf<T extends string>(values: readonly T[]) {
  return (v: unknown): v is T => typeof v === 'string' && (values as readonly string[]).includes(v);
}

export function nullableNumber(v: unknown): v is number | null {
  return v === null || (typeof v === 'number' && Number.isFinite(v));
}

export function nullableString(v: unknown): v is string | null {
  return v === null || typeof v === 'string';
}
