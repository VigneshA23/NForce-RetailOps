import type {
  StockCheckHistoryStatusFilter,
  StockCheckResponse,
  StockCheckStatusCounts,
  SuperAdminStockCheckResponse,
} from '../types/stockCheck';

// The history chips: "all" plus the three server-side filters.
export type StockCheckHistoryStatusChoice = 'all' | StockCheckHistoryStatusFilter;

// "all" is the absence of the ?status= param.
export function statusChoiceToParam(choice: StockCheckHistoryStatusChoice): StockCheckHistoryStatusFilter | undefined {
  return choice === 'all' ? undefined : choice;
}

export const EMPTY_STATUS_COUNTS: StockCheckStatusCounts = { all: 0, shortage: 0, sufficient: 0, notCounted: 0 };

// 'skipped': End of Day was explained as not countable instead of counted.
export type StockCheckHistoryRowStatus = 'shortage' | 'optimal' | 'pending' | 'skipped';

export interface StockCheckHistoryRowView extends StockCheckResponse {
  counted: number | null;
  deficit: number | null;
  buffer: number | null;
  status: StockCheckHistoryRowStatus;
}

function roundQuantity(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
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
  const deficit = hasData ? roundQuantity(Math.max(0, row.requiredPar! - counted!)) : null;
  const status: StockCheckHistoryRowStatus = deficit != null && deficit > 0
    ? 'shortage'
    : hasData
      ? 'optimal'
      : counted == null && row.endOfDaySkipped
        ? 'skipped'
        : 'pending';
  const buffer = hasData && status === 'optimal' ? roundQuantity(counted! - row.requiredPar!) : null;
  return { ...row, counted, deficit, buffer, status };
}

// Super Admin's cross-store history (RTS-305) -- same row shape, labelled
// with its store, so the table can show a Store column in all-stores mode.
export interface SuperAdminStockCheckHistoryRowView extends StockCheckHistoryRowView {
  storeId: number;
  storeName: string;
}

export function toSuperAdminStockCheckHistoryRowView(entry: SuperAdminStockCheckResponse): SuperAdminStockCheckHistoryRowView {
  return { ...toStockCheckHistoryRowView(entry.check), storeId: entry.storeId, storeName: entry.storeName };
}
