import { useEffect, useState } from 'react';
import { getRecentActivity } from '../api/activity';
import type { ActivityDateRange } from '../api/activity';
import type { ActivityLogEntry } from '../types/activity';

// null while the initial fetch is in flight; refetches whenever limit or
// range changes (used to implement "View all" by bumping the limit rather
// than paginating, and the Recent Activity page's date filter by passing a
// range).
export function useRecentActivity(limit: number, range?: ActivityDateRange): ActivityLogEntry[] | null {
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    getRecentActivity(limit, range)
      .then((data) => {
        if (active) setEntries(data);
      })
      .catch(() => {
        if (active) setEntries([]);
      });
    return () => {
      active = false;
    };
  }, [limit, range?.startDate, range?.endDate]);

  return entries;
}
