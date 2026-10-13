import { apiRequest } from './client';
import type { StockReceiptRequest } from '../types/notification';

// Owner/Admin's decision on an employee's received-stock request. Approving
// applies the delivery to stock (and marks an existing order Received).
export async function approveStockReceiptRequest(id: number): Promise<StockReceiptRequest> {
  return apiRequest<StockReceiptRequest>(`/stores/stock-receipt-requests/${id}/approve`, { method: 'POST' });
}

export async function rejectStockReceiptRequest(id: number): Promise<StockReceiptRequest> {
  return apiRequest<StockReceiptRequest>(`/stores/stock-receipt-requests/${id}/reject`, { method: 'POST' });
}
