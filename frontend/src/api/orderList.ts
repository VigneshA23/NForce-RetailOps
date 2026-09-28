import { apiRequest } from './client';
import type { OrderListEntry, UpdateOrderListEntryValues } from '../types/orderList';

// Owner/Admin's Order Dashboard, scoped to their own store.
export async function getOrderList(): Promise<OrderListEntry[]> {
  return apiRequest<OrderListEntry[]>('/stores/order-list');
}

// Backs the Home low-stock tile. Unwrapped the same way as getUnreadCount --
// the backend returns {"count": n} for both.
export async function getNeedsOrderingCount(): Promise<number> {
  const data = await apiRequest<{ count: number }>('/stores/order-list/needs-ordering-count');
  return data.count;
}

export async function updateOrderListEntry(id: number, values: UpdateOrderListEntryValues): Promise<OrderListEntry> {
  return apiRequest<OrderListEntry>(`/stores/order-list/${id}`, {
    method: 'PATCH',
    body: {
      quantityNeeded: Number(values.quantityNeeded),
      supplierId: values.supplierId,
      note: values.note.trim() === '' ? null : values.note.trim(),
      status: values.status,
    },
  });
}
