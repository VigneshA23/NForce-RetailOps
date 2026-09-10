import { apiRequest } from './client';
import type { OrderListEntry, UpdateOrderListEntryValues } from '../types/orderList';

// Owner/Admin's Order Dashboard, scoped to their own store.
export async function getOrderList(): Promise<OrderListEntry[]> {
  return apiRequest<OrderListEntry[]>('/stores/order-list');
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
