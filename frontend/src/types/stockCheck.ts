export interface StockCheckResponse {
  id: number;
  storeInventoryItemId: number;
  itemName: string;
  checkDate: string;
  currentCount: number;
  quantityNeeded: number;
  checkedByName: string;
  createdAt: string;
  corrected: boolean;
  originalCurrentCount: number | null;
  correctedByName: string | null;
  correctedAt: string | null;
}

// GET /api/stores/inventory/stock-checks?startDate=&endDate=&page=&size= --
// shape matches components/Pagination.tsx's props (1-indexed page) so the
// view can pass it through without translation.
export interface StockCheckHistoryPage {
  items: StockCheckResponse[];
  page: number;
  pageSize: number;
  pageCount: number;
  totalItems: number;
}

// One row of the employee's Daily Stock Check screen.
export interface DailyStockCheckItem {
  storeInventoryItemId: number;
  itemName: string;
  unitOfMeasurement: string;
  minTarget: number | null;
  currentCount: number | null;
  quantityNeeded: number | null;
  checkedToday: boolean;
}
