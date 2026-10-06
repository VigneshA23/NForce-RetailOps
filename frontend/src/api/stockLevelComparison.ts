import { apiRequest } from './client';
import type { StockLevelComparisonRow } from '../types/stockLevelComparison';

export async function compareStockLevels(itemName: string): Promise<StockLevelComparisonRow[]> {
  return apiRequest<StockLevelComparisonRow[]>(
    `/super-admin/inventory/stock-comparison?itemName=${encodeURIComponent(itemName)}`,
  );
}
