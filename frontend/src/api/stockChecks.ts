import { apiRequest } from './client';
import type { MissedEndOfDayItem } from '../types/notification';
import type {
  DailyStockCheckItem,
  StockCheckHistoryPage,
  StockCheckResponse,
  StockCheckSnapshotKey,
  StoreInventoryItemOption,
} from '../types/stockCheck';

// Employee-facing: Daily Stock Check screen + ad-hoc shortage reporting.
export async function getTodayStockCheck(storeId: number): Promise<DailyStockCheckItem[]> {
  return apiRequest<DailyStockCheckItem[]>(`/me/inventory?storeId=${storeId}`);
}

// Full item roster for the "Report Shortage" picker -- active and inactive
// alike, matching Owner/Admin's Inventory Items list, unlike
// getTodayStockCheck above (today's active checklist only).
export async function getAllStoreItemsForEmployee(storeId: number): Promise<StoreInventoryItemOption[]> {
  return apiRequest<StoreInventoryItemOption[]>(`/me/inventory/items?storeId=${storeId}`);
}

// Saves today's Start of Day or End of Day count; saving the same snapshot
// again updates it in place. quantityReceived is End of Day only: stock
// delivered today. It is not applied on save: it becomes a request the admin
// approves (each item is new stock, or an existing Ordered order it confirms; several can be sent together).
export async function submitStockCheck(
  storeId: number,
  storeInventoryItemId: number,
  snapshot: StockCheckSnapshotKey,
  available: number,
  deadStock: number,
  receivedItems?: { orderEntryId: number | null; quantity: number }[],
  // Start of Day only: why the count is below the last End of Day.
  lowerCountReason?: string,
): Promise<StockCheckResponse> {
  return apiRequest<StockCheckResponse>('/me/inventory/stock-checks', {
    method: 'POST',
    body: {
      storeId,
      storeInventoryItemId,
      snapshot,
      available,
      deadStock,
      receivedItems: receivedItems ?? null,
      lowerCountReason: lowerCountReason ?? null,
    },
  });
}

// Employee-facing mirror of Owner/Admin's stock-check history, scoped to one
// of the caller's own assigned stores.
export async function getEmployeeStockCheckHistory(
  storeId: number,
  startDate: string,
  endDate: string,
  page: number,
  size: number,
): Promise<StockCheckHistoryPage> {
  const params = new URLSearchParams({
    storeId: String(storeId),
    startDate,
    endDate,
    page: String(page),
    size: String(size),
  });
  return apiRequest<StockCheckHistoryPage>(`/me/inventory/stock-checks?${params.toString()}`);
}

export async function reportAdHocShortage(
  storeId: number,
  storeInventoryItemId: number,
  currentStock: number,
  note?: string,
  orderedAlreadyReceived = false,
): Promise<void> {
  return apiRequest<void>(`/me/inventory/ad-hoc?storeId=${storeId}`, {
    method: 'POST',
    body: { storeInventoryItemId, currentStock, note: note?.trim() || null, orderedAlreadyReceived },
  });
}

// Answers yesterday's missing End of Day for one item: the count, or
// couldNotCount with a reason (at least 15 words). Only the first answer from
// anyone in the store is accepted.
export interface MissedEndOfDayAnswer {
  storeInventoryItemId: number;
  available?: number;
  deadStock?: number;
  couldNotCount?: boolean;
  reason?: string;
}

export async function answerMissedEndOfDay(storeId: number, answer: MissedEndOfDayAnswer): Promise<MissedEndOfDayItem> {
  return apiRequest<MissedEndOfDayItem>('/me/inventory/missed-end-of-day', {
    method: 'POST',
    body: { storeId, couldNotCount: false, ...answer },
  });
}
