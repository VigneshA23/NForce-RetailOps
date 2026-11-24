import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';

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

function localDayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

interface DayScoped<T> {
  value: T;
  savedOn: string;
}

// Like usePersistedState, but the stored value only lives for the calendar
// day it was saved on. For a history page's chosen date: a refresh keeps the
// date the user was looking at, but opening the app the next day starts from
// the page's normal default again instead of a stale day.
export function useDayScopedState<T>(
  key: string,
  initial: T,
  isValid: (value: unknown) => value is T = (_v): _v is T => true,
): [T, Dispatch<SetStateAction<T>>] {
  const isStored = (v: unknown): v is DayScoped<T> =>
    typeof v === 'object' && v !== null
    && (v as DayScoped<T>).savedOn === localDayKey()
    && isValid((v as DayScoped<T>).value);
  const [stored, setStored] = usePersistedState<DayScoped<T>>(
    key,
    { value: initial, savedOn: localDayKey() },
    isStored,
  );
  // Stable like a useState setter, so it is safe in effect dependency lists.
  const setValue = useCallback<Dispatch<SetStateAction<T>>>((action) => {
    setStored((current) => ({
      value: typeof action === 'function' ? (action as (prev: T) => T)(current.value) : action,
      savedOn: localDayKey(),
    }));
  }, [setStored]);
  return [stored.value, setValue];
}

// A YYYY-MM-DD date no later than today (history pages never show the future).
export function pastOrTodayDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && v <= localDayKey();
}

// A history page's "Last Week" range ({ start, end }), or null for single-day view.
export function nullablePastRange(v: unknown): v is { start: string; end: string } | null {
  if (v === null) return true;
  if (typeof v !== 'object') return false;
  const range = v as { start?: unknown; end?: unknown };
  return pastOrTodayDate(range.start) && pastOrTodayDate(range.end) && (range.start as string) <= (range.end as string);
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
