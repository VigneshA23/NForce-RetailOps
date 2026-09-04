import { useCallback, useEffect, useState } from 'react';
import { getNotifications, markAllNotificationsRead, markNotificationRead } from '../api/notifications';
import type { NotificationItem } from '../api/notifications';

interface NotificationsState {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * Loads the signed-in employee's notifications. Fetched once per shell
 * session and shared, the same "fetch once, share via props" pattern as
 * useOwnerEmployees/useAssignedStores -- the header's unread badge and the
 * Notifications page both read one list rather than each fetching their own.
 */
export function useNotifications(enabled: boolean): NotificationsState {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => setReloadToken((token) => token + 1), []);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setError(null);

    getNotifications()
      .then((result) => {
        if (active) setNotifications(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Failed to load notifications');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, reloadToken]);

  async function markRead(id: number) {
    const updated = await markNotificationRead(id);
    setNotifications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  async function markAllRead() {
    await markAllNotificationsRead();
    setNotifications((current) => current.map((item) => ({ ...item, read: true })));
  }

  const unreadCount = notifications.filter((item) => !item.read).length;

  return { notifications, unreadCount, isLoading, error, reload, markRead, markAllRead };
}
