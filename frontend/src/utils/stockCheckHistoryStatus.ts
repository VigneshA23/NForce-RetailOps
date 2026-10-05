import type { StockCheckResponse } from '../types/stockCheck';

export type StockCheckHistoryRowStatus = 'shortage' | 'optimal' | 'pending';

export interface StockCheckHistoryRowView extends StockCheckResponse {
  counted: number | null;
  deficit: number | null;
  buffer: number | null;
  status: StockCheckHistoryRowStatus;
}

// "Counted" is the day's End of Day count (what actually got reconciled);
// "Required Par" (requiredPar) is that day's own par level, set regardless of
// whether End of Day was ever recorded -- unlike requiredTomorrow (the
// forward-looking threshold that drives the order list), so a row always has
// a par to compare against. Deficit/buffer are computed here against that
// par, the same "available vs target" comparison the live Daily Stock Entry
// page uses, rather than reusing quantityToOrder (a different, next-day
// metric). Shared by both the employee card view (EmployeeStockCheckHistory)
// and the Owner/Admin table (StockCheckHistory) so the two can't classify the
// same row differently.
export function toStockCheckHistoryRowView(row: StockCheckResponse): StockCheckHistoryRowView {
  const counted = row.endOfDay?.usable ?? null;
  const hasData = counted != null && row.requiredPar != null;
  const deficit = hasData ? Math.max(0, row.requiredPar! - counted!) : null;
  const status: StockCheckHistoryRowStatus = deficit != null && deficit > 0 ? 'shortage' : hasData ? 'optimal' : 'pending';
  const buffer = hasData && status === 'optimal' ? counted! - row.requiredPar! : null;
  return { ...row, counted, deficit, buffer, status };
}
