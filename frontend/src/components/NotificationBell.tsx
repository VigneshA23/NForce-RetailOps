import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCheck,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  ListPlus,
  MailX,
  PenLine,
  Store,
  TriangleAlert,
  UserCheck,
  UserMinus,
  UserPlus,
  UserX,
  type LucideIcon,
} from 'lucide-react';
import { getNotifications, markAllRead, markNotificationRead } from '../api/notifications';
import type { Notification } from '../types/notification';
import './NotificationBell.css';

interface NotificationBellProps {
  unreadCount: number;
  onCountChange: (count: number) => void;
  onViewAll: () => void;
  onNavigate?: (path: string) => void;
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

interface CategoryMeta {
  icon: LucideIcon;
  bgVar: string;
  fgVar: string;
}

function categoryMeta(category: string): CategoryMeta {
  switch (category) {
    case 'ISSUE_RAISED':
      return { icon: AlertCircle, bgVar: '--color-badge-icon-primary-bg', fgVar: '--color-badge-icon-primary-fg' };
    case 'ISSUE_ACKNOWLEDGED':
      return { icon: Clock, bgVar: '--color-badge-icon-warning-bg', fgVar: '--color-badge-icon-warning-fg' };
    case 'ISSUE_RESOLVED':
      return { icon: CheckCircle2, bgVar: '--color-badge-icon-success-bg', fgVar: '--color-badge-icon-success-fg' };
    case 'CORRECTION_MADE':
      return { icon: PenLine, bgVar: '--color-badge-icon-info-bg', fgVar: '--color-badge-icon-info-fg' };
    case 'STORE_DEACTIVATED':
      return { icon: Store, bgVar: '--color-badge-icon-warning-bg', fgVar: '--color-badge-icon-warning-fg' };
    case 'STORE_REACTIVATED':
      return { icon: Store, bgVar: '--color-badge-icon-success-bg', fgVar: '--color-badge-icon-success-fg' };
    case 'ACCOUNT_DEACTIVATED':
    case 'EMPLOYEE_ACCOUNT_DEACTIVATED':
      return { icon: UserX, bgVar: '--color-badge-icon-warning-bg', fgVar: '--color-badge-icon-warning-fg' };
    case 'ACCOUNT_REACTIVATED':
    case 'EMPLOYEE_ACCOUNT_REACTIVATED':
      return { icon: UserCheck, bgVar: '--color-badge-icon-success-bg', fgVar: '--color-badge-icon-success-fg' };
    case 'TASK_ADDED':
      return { icon: ClipboardList, bgVar: '--color-badge-icon-info-bg', fgVar: '--color-badge-icon-info-fg' };
    case 'CATEGORY_ADDED':
      return { icon: ListPlus, bgVar: '--color-badge-icon-info-bg', fgVar: '--color-badge-icon-info-fg' };
    case 'EMPLOYEE_ASSIGNED':
    case 'NEW_EMPLOYEE_JOINED':
      return { icon: UserPlus, bgVar: '--color-badge-icon-success-bg', fgVar: '--color-badge-icon-success-fg' };
    case 'EMPLOYEE_REMOVED':
      return { icon: UserMinus, bgVar: '--color-badge-icon-warning-bg', fgVar: '--color-badge-icon-warning-fg' };
    case 'STORE_ZERO_ACTIVITY':
      return { icon: TriangleAlert, bgVar: '--color-badge-icon-warning-bg', fgVar: '--color-badge-icon-warning-fg' };
    case 'ISSUES_OVERDUE':
      return { icon: Clock, bgVar: '--color-badge-icon-warning-bg', fgVar: '--color-badge-icon-warning-fg' };
    case 'OWNER_EMAIL_FAILED':
      return { icon: MailX, bgVar: '--color-badge-icon-warning-bg', fgVar: '--color-badge-icon-warning-fg' };
    default:
      return { icon: Bell, bgVar: '--color-badge-icon-info-bg', fgVar: '--color-badge-icon-info-fg' };
  }
}

interface NotifItemProps {
  notification: Notification;
  onRead: (id: number) => void;
  onViewAll: () => void;
  onNavigate?: (path: string) => void;
}

function NotifItem({ notification, onRead, onViewAll, onNavigate }: NotifItemProps) {
  const { icon: Icon, bgVar, fgVar } = categoryMeta(notification.category);

  function handleClick() {
    onRead(notification.id);
    if (notification.linkPath && onNavigate) {
      onNavigate(notification.linkPath);
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
        <p className="nb-item__msg">{notification.message}</p>
        <span className="nb-item__time">{relativeTime(notification.createdAt)}</span>
      </div>
      {!notification.read && <span className="nb-item__dot" aria-hidden="true" />}
    </button>
  );
}

function NotificationBell({ unreadCount, onCountChange, onViewAll, onNavigate }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    getNotifications()
      .then((data) => setNotifications(data.slice(0, 4)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open]);

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

  function handleNavigate(path: string) {
    setOpen(false);
    if (onNavigate) onNavigate(path);
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
