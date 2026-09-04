import { apiRequest } from './client';

export type NotificationCategory = 'ISSUE_RESPONSE';
export type NotificationPriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface NotificationItem {
  id: number;
  title: string;
  message: string;
  category: NotificationCategory;
  priority: NotificationPriority;
  read: boolean;
  createdAt: string;
}

export async function getNotifications(): Promise<NotificationItem[]> {
  return apiRequest<NotificationItem[]>('/me/notifications');
}

export async function markNotificationRead(id: number): Promise<NotificationItem> {
  return apiRequest<NotificationItem>(`/me/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllNotificationsRead(): Promise<void> {
  await apiRequest<unknown>('/me/notifications/read-all', { method: 'PATCH' });
}
