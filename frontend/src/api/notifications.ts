import { apiRequest } from './client';
import type { Notification } from '../types/notification';

export async function getNotifications(): Promise<Notification[]> {
  return apiRequest<Notification[]>('/notifications');
}

export async function getUnreadCount(): Promise<number> {
  const data = await apiRequest<{ count: number }>('/notifications/unread-count');
  return data.count;
}

export async function markNotificationRead(id: number): Promise<Notification> {
  return apiRequest<Notification>(`/notifications/${id}/read`, { method: 'PATCH' });
}

export async function markAllRead(): Promise<void> {
  await apiRequest<void>('/notifications/mark-all-read', { method: 'PATCH' });
}

export async function deleteNotification(id: number): Promise<void> {
  await apiRequest<void>(`/notifications/${id}`, { method: 'DELETE' });
}
