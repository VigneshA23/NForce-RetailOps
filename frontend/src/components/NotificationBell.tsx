import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Bell, CheckCheck, ChevronRight, RefreshCw } from 'lucide-react';
import { getNotifications, markAllRead, markNotificationRead } from '../api/notifications';
import NotificationMessage from './NotificationMessage';
import type { Notification } from '../types/notification';
import type { StoreSummary } from '../types/store';
import { getCategoryMeta } from '../utils/notificationCategoryMeta';
import { isNotificationVisibleForStore } from '../utils/notificationStore';
import type { NotificationNavContext, NotificationNavigateHandler } from '../utils/notificationRoutes';
import './NotificationBell.css';

interface NotificationBellProps {
  unreadCount: number;
  onCountChange: (count: number) => void;
  onViewAll: () => void;
  onNavigate?: NotificationNavigateHandler;
  activeStoreId?: number;
  assignedStores?: StoreSummary[];
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function badgeLabel(count: number): string {
  return count > 9 ? '9+' : String(count);
}

interface NotifItemProps {
  notification: Notification;
  onRead: (id: number) => void;
  onViewAll: () => void;
  onNavigate?: NotificationNavigateHandler;
  assignedStores?: StoreSummary[];
}

function NotifItem({ notification, onRead, onViewAll, onNavigate, assignedStores }: NotifItemProps) {
  const { icon: Icon, bgVar, fgVar } = getCategoryMeta(notification.category);

  function handleClick() {
    onRead(notification.id);
    if (notification.linkPath && onNavigate) {
      onNavigate(notification.linkPath, { createdAt: notification.createdAt, relatedIssueId: notification.relatedIssueId, storeId: notification.storeId ?? null });
    } else {
      onViewAll();
    }
  }

  return (
    <button
      type="button"
      className={`nb-item${notification.read ? '' : ' nb-item--unread'}`}
      onClick={handleClick}
    >
      <span
        className="nb-item__icon"
        style={{ background: `var(${bgVar})`, color: `var(${fgVar})` }}
        aria-hidden="true"
      >
        <Icon size={14} strokeWidth={2} />
      </span>
      <div className="nb-item__body">
        <p className="nb-item__title">{notification.title}</p>
        <p className="nb-item__msg"><NotificationMessage notification={notification} assignedStores={assignedStores} /></p>
        <span className="nb-item__time">{relativeTime(notification.createdAt)}</span>
      </div>
      {!notification.read && <span className="nb-item__dot" aria-hidden="true" />}
    </button>
  );
}

function NotificationBell({ unreadCount, onCountChange, onViewAll, onNavigate, activeStoreId, assignedStores }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const fetchSequence = useRef(0);

  const fetchNotifications = useCallback(async () => {
    const sequence = ++fetchSequence.current;
    setLoading(true);
    setError(false);
    try {
      if (!assignedStores || activeStoreId == null) {
        const data = await getNotifications();
        if (sequence === fetchSequence.current) setNotifications(data.slice(0, 4));
        return;
      }

      const matching: Notification[] = [];
      const pageSize = 100;
      let page = 0;
      while (matching.length < 4) {
        const data = await getNotifications(page, pageSize);
        const existingIds = new Set(matching.map((notification) => notification.id));
        for (const notification of data) {
          if (
            existingIds.has(notification.id) ||
            !isNotificationVisibleForStore(notification, assignedStores, activeStoreId)
          ) continue;
          existingIds.add(notification.id);
          matching.push(notification);
        }
        if (data.length < pageSize) break;
        page += 1;
      }
      if (sequence === fetchSequence.current) setNotifications(matching.slice(0, 4));
    } catch {
      if (sequence === fetchSequence.current) setError(true);
    } finally {
      if (sequence === fetchSequence.current) setLoading(false);
    }
  }, [activeStoreId, assignedStores]);

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
  }, [open, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleMarkAllRead() {
    await markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    onCountChange(0);
  }

  async function handleItemRead(id: number) {
    const notif = notifications.find((n) => n.id === id);
    if (notif && !notif.read) {
      await markNotificationRead(id).catch(() => {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
      onCountChange(Math.max(0, unreadCount - 1));
    }
    setOpen(false);
  }

  function handleViewAll() {
    setOpen(false);
    onViewAll();
  }

  function handleNavigate(path: string, context?: NotificationNavContext) {
    setOpen(false);
    if (onNavigate) onNavigate(path, context);
  }

  return (
    <div className="nb" ref={containerRef}>
      <button
        type="button"
        className={`nb__trigger${open ? ' nb__trigger--open' : ''}${unreadCount > 0 ? ' nb__trigger--has-unread' : ''}`}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="nb__badge" aria-hidden="true" key={unreadCount}>
            {badgeLabel(unreadCount)}
          </span>
        )}
      </button>

      {open && (
        <div className="nb__dropdown" role="dialog" aria-label="Notifications">
          <div className="nb__header">
            <span className="nb__header-title">
              Notifications
              {unreadCount > 0 && (
                <span className="nb__header-count">{unreadCount}</span>
              )}
            </span>
            {unreadCount > 0 && (
              <button type="button" className="nb__mark-all" onClick={handleMarkAllRead}>
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          <div className="nb__list">
            {loading ? (
              <div className="nb__loading">
                <span className="nb__loading-dot" />
                <span className="nb__loading-dot" />
                <span className="nb__loading-dot" />
              </div>
            ) : error ? (
              <div className="nb__error">
                <AlertCircle size={24} strokeWidth={1.5} />
                <p>Failed to load notifications.</p>
                <button type="button" className="nb__retry" onClick={fetchNotifications}>
                  <RefreshCw size={12} />
                  Retry
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="nb__empty">
                <Bell size={28} strokeWidth={1.5} />
                <p>You're all caught up</p>
              </div>
            ) : (
              notifications.map((n) => (
                <NotifItem
                  key={n.id}
                  notification={n}
                  onRead={handleItemRead}
                  onViewAll={handleViewAll}
                  onNavigate={n.linkPath ? handleNavigate : undefined}
                  assignedStores={assignedStores}
                />
              ))
            )}
          </div>

          <button type="button" className="nb__view-all" onClick={handleViewAll}>
            View all notifications
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

export default NotificationBell;
