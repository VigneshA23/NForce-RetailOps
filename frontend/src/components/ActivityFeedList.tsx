import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Clock,
  ListChecks,
  Pencil,
  Store as StoreIcon,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { ActivityLogEntry } from '../types/activity';
import { formatRelativeTime } from '../utils/relativeTime';
import './ActivityFeedList.css';

// Keyed by the actionType prefix (before the first underscore) so new action
// types added later fall back to a sensible default instead of needing a
// matching entry here first.
const ACTION_VISUALS: Record<string, { icon: LucideIcon; tone: string }> = {
  CATEGORY: { icon: Tags, tone: 'accent' },
  EMPLOYEE: { icon: Users, tone: 'info' },
  TASK: { icon: ListChecks, tone: 'good' },
  ISSUE: { icon: AlertTriangle, tone: 'warning' },
  RESPONSE: { icon: Pencil, tone: 'warning' },
  OWNER: { icon: Building2, tone: 'accent' },
  STORE: { icon: StoreIcon, tone: 'info' },
};

function visualFor(actionType: string): { icon: LucideIcon; tone: string } {
  if (actionType.includes('RESOLVED') || actionType.includes('ACTIVATED')) {
    return { icon: CheckCircle2, tone: 'good' };
  }
  const prefix = actionType.split('_')[0];
  return ACTION_VISUALS[prefix] ?? { icon: Clock, tone: 'neutral' };
}

interface ActivityFeedListProps {
  entries: ActivityLogEntry[] | null;
}

function ActivityFeedList({ entries }: ActivityFeedListProps) {
  return (
    <div className="activity-feed">
      {entries === null && <p className="activity-feed__empty">Loading…</p>}
      {entries !== null && entries.length === 0 && (
        <p className="activity-feed__empty">No activity yet.</p>
      )}
      {entries !== null && entries.length > 0 && (
        <div className="activity-feed__rows">
          {entries.map((entry) => {
            const { icon: Icon, tone } = visualFor(entry.actionType);
            return (
              <div key={entry.id} className="activity-feed__row">
                <span className={`activity-feed__icon activity-feed__icon--${tone}`}>
                  <Icon size={14} />
                </span>
                <div className="activity-feed__row-main">
                  <span className="activity-feed__description">
                    <strong>{entry.actorName}</strong> — {entry.description.replace(/^./, (c) => c.toLowerCase())}
                  </span>
                  {entry.storeName && <span className="activity-feed__store">{entry.storeName}</span>}
                </div>
                <span className="activity-feed__time">{formatRelativeTime(entry.occurredAt)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ActivityFeedList;
