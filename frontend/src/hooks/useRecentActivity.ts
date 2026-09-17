import { useEffect, useState } from 'react';
import { getRecentActivity } from '../api/activity';
import type { ActivityLogEntry } from '../types/activity';

// null while the initial fetch is in flight; refetches whenever limit changes
// (used to implement "View all" by bumping the limit rather than paginating).
export function useRecentActivity(limit: number): ActivityLogEntry[] | null {
  const [entries, setEntries] = useState<ActivityLogEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    getRecentActivity(limit)
      .then((data) => {
        if (active) setEntries(data);
      })
      .catch(() => {
        if (active) setEntries([]);
      });
    return () => {
      active = false;
    };
  }, [limit]);

  return entries;
}
