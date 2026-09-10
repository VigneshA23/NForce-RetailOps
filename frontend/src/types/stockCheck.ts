export interface StockCheckResponse {
  id: number;
  storeInventoryItemId: number;
  itemName: string;
  checkDate: string;
  currentCount: number;
  quantityNeeded: number;
  checkedByName: string;
  createdAt: string;
}

// One row of the employee's Daily Stock Check screen.
export interface DailyStockCheckItem {
  storeInventoryItemId: number;
  itemName: string;
  categoryName: string;
  unitOfMeasurement: string;
  minTarget: number | null;
  currentCount: number | null;
  quantityNeeded: number | null;
  checkedToday: boolean;
}
