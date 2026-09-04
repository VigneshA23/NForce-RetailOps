import { useMemo, useState } from 'react';
import { AlertTriangle, BellOff, CheckCheck, MessageSquareWarning } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { NotificationCategory, NotificationItem, NotificationPriority } from '../api/notifications';
import SearchInput from '../components/SearchInput';
import { formatTimeLabel } from '../utils/checklistHistoryOptions';
import './Notifications.css';

interface NotificationsProps {
  notifications: NotificationItem[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onMarkRead: (id: number) => void;
  onMarkAllRead: () => void;
}

type ReadFilter = 'ALL' | 'UNREAD' | 'READ';
type SortOrder = 'NEWEST' | 'OLDEST';

const CATEGORY_META: Record<NotificationCategory, { label: string; icon: LucideIcon }> = {
  ISSUE_RESPONSE: { label: 'Issue Response', icon: MessageSquareWarning },
};

const PRIORITY_META: Record<NotificationPriority, { label: string; badgeClass: string }> = {
  LOW: { label: 'Low', badgeClass: 'badge--outline' },
  NORMAL: { label: 'Normal', badgeClass: 'badge--info' },
  HIGH: { label: 'High', badgeClass: 'badge--danger' },
};

function isToday(isoTimestamp: string): boolean {
  const date = new Date(isoTimestamp);
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function formatFullDate(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function NotificationCard({
  notification,
  onMarkRead,
}: {
  notification: NotificationItem;
  onMarkRead: (id: number) => void;
}) {
  const category = CATEGORY_META[notification.category];
  const priority = PRIORITY_META[notification.priority];
  const Icon = category.icon;

  return (
    <button
      type="button"
      className={`notification-card${notification.read ? '' : ' notification-card--unread'}`}
      onClick={() => {
        if (!notification.read) onMarkRead(notification.id);
      }}
    >
      {!notification.read && <span className="notification-card__unread-dot" aria-hidden="true" />}
      <span className="notification-card__icon">
        <Icon size={18} />
      </span>
      <span className="notification-card__body">
        <span className="notification-card__top">
          <span className="notification-card__title">{notification.title}</span>
          <span className="notification-card__time">{formatTimeLabel(notification.createdAt)}</span>
        </span>
        <span className="notification-card__message">{notification.message}</span>
        <span className="notification-card__meta">
          <span className="badge badge--outline">{category.label}</span>
          <span className={`badge ${priority.badgeClass}`}>{priority.label}</span>
        </span>
      </span>
    </button>
  );
}

function Notifications({ notifications, isLoading, error, onRetry, onMarkRead, onMarkAllRead }: NotificationsProps) {
  const [search, setSearch] = useState('');
  const [readFilter, setReadFilter] = useState<ReadFilter>('ALL');
  const [sortOrder, setSortOrder] = useState<SortOrder>('NEWEST');

  const unreadCount = useMemo(() => notifications.filter((item) => !item.read).length, [notifications]);
  const totalCount = notifications.length;

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return notifications
      .filter((item) => {
        if (readFilter === 'UNREAD' && item.read) return false;
        if (readFilter === 'READ' && !item.read) return false;
        if (!query) return true;
        return item.title.toLowerCase().includes(query) || item.message.toLowerCase().includes(query);
      })
      .sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        return sortOrder === 'NEWEST' ? -diff : diff;
      });
  }, [notifications, search, readFilter, sortOrder]);

  const todayItems = filtered.filter((item) => isToday(item.createdAt));
  const earlierItems = filtered.filter((item) => !isToday(item.createdAt));

  // Earlier items span multiple days once notifications age past 24h -- grouped
  // by calendar date so "Earlier" doesn't read as one undifferentiated pile.
  const earlierByDate = useMemo(() => {
    const groups = new Map<string, NotificationItem[]>();
    for (const item of earlierItems) {
      const key = formatFullDate(item.createdAt);
      const group = groups.get(key);
      if (group) group.push(item);
      else groups.set(key, [item]);
    }
    return Array.from(groups.entries());
  }, [earlierItems]);

  return (
    <div className="notifications-page">
      <div className="notifications-page__header">
        <div>
          <h1 className="notifications-page__heading">Notifications</h1>
          <p className="notifications-page__subheading">
            <span className="notifications-page__count notifications-page__count--unread">{unreadCount} unread</span>
            {' · '}
            <span className="notifications-page__count">{totalCount} total</span>
          </p>
        </div>
        <button
          type="button"
          className="btn btn--secondary notifications-page__mark-all"
          onClick={onMarkAllRead}
          disabled={unreadCount === 0}
        >
          <CheckCheck size={16} />
          Mark all as read
        </button>
      </div>

      <div className="filter-bar notifications-page__filters">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search notifications" variant="card" />
        </div>
        <select
          className="select filter"
          value={readFilter}
          onChange={(event) => setReadFilter(event.target.value as ReadFilter)}
          aria-label="Filter by read status"
        >
          <option value="ALL">All</option>
          <option value="UNREAD">Unread</option>
          <option value="READ">Read</option>
        </select>
        <select
          className="select filter"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value as SortOrder)}
          aria-label="Sort notifications"
        >
          <option value="NEWEST">Newest first</option>
          <option value="OLDEST">Oldest first</option>
        </select>
      </div>

      {isLoading && (
        <div className="notifications-page__skeleton" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="notifications-page__skeleton-card" />
          ))}
        </div>
      )}

      {!isLoading && error && (
        <div className="notifications-page__error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && filtered.length === 0 && (
        <div className="notifications-page__empty">
          <BellOff size={28} />
          <h3>No notifications</h3>
          <p>
            {notifications.length === 0
              ? "You're all caught up. Nothing here yet."
              : 'No notifications match your filters.'}
          </p>
        </div>
      )}

      {!isLoading && !error && filtered.length > 0 && (
        <div className="notifications-page__list">
          {todayItems.length > 0 && (
            <div className="notifications-page__section">
              <h2 className="notifications-page__section-heading">Today</h2>
              <div className="notifications-page__cards">
                {todayItems.map((item) => (
                  <NotificationCard key={item.id} notification={item} onMarkRead={onMarkRead} />
                ))}
              </div>
            </div>
          )}

          {earlierByDate.length > 0 && (
            <div className="notifications-page__section">
              <h2 className="notifications-page__section-heading">Earlier</h2>
              {earlierByDate.map(([dateLabel, items]) => (
                <div key={dateLabel} className="notifications-page__cards">
                  <p className="notifications-page__date-label">{dateLabel}</p>
                  {items.map((item) => (
                    <NotificationCard key={item.id} notification={item} onMarkRead={onMarkRead} />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default Notifications;
