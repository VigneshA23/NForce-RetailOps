import { apiRequest } from './client';
import type {
  CreateOrderListEntryValues,
  OrderListEntry,
  SupplierPurchaseMetric,
  UpdateOrderListEntryValues,
} from '../types/orderList';

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

// "Add to order": manually adding an existing or custom one-off item,
// outside the automatic shortage detection that normally populates this list.
export async function createOrderListEntry(values: CreateOrderListEntryValues): Promise<OrderListEntry> {
  return apiRequest<OrderListEntry>('/stores/order-list', {
    method: 'POST',
    body: {
      storeInventoryItemId: values.storeInventoryItemId,
      itemName: values.itemName.trim() === '' ? null : values.itemName.trim(),
      category: values.category,
      unitOfMeasurement: values.unitOfMeasurement.trim() === '' ? null : values.unitOfMeasurement.trim(),
      saveToInventory: values.saveToInventory,
      minWeekday: values.minWeekday.trim() === '' ? null : Number(values.minWeekday),
      minWeekend: values.minWeekend.trim() === '' ? null : Number(values.minWeekend),
      quantityNeeded: Number(values.quantityNeeded),
      supplierId: values.supplierId,
      note: values.note.trim() === '' ? null : values.note.trim(),
    },
  });
}

// Supplier Purchasing Summary, scoped server-side to the owner's own store --
// there is no storeId to pass here.
export async function getSupplierPurchaseMetrics(fromDate: string, toDate: string): Promise<SupplierPurchaseMetric[]> {
  const params = new URLSearchParams({ fromDate, toDate });
  return apiRequest<SupplierPurchaseMetric[]>(`/stores/order-list/supplier-metrics?${params}`);
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
