// Mirrors the backend's DailyCashEntryRequest / DailyCashEntryResponse
// (RTS-291). Amounts are BigDecimal on the server and plain numbers here.

export type CashAmountField =
  | 'totalCashSales'
  | 'openingDrawerCash'
  | 'cashRemoved'
  | 'cashRemaining'
  | 'cashExpenses'
  | 'bankDeposits'
  | 'otherAdjustments';

export type CashAmounts = Record<CashAmountField, number>;

export interface DailyCashEntryRequest extends CashAmounts {
  // YYYY-MM-DD; the server defaults to today when omitted.
  businessDate: string;
}

export interface DailyCashEntry extends CashAmounts {
  id: number;
  storeId: number;
  businessDate: string;
  enteredByUserId: number | null;
  enteredBySuperAdminId: number | null;
  enteredAt: string;
  updatedByUserId: number | null;
  updatedBySuperAdminId: number | null;
  updatedAt: string;
  // Prior versions of the entry, oldest first; empty until the first re-save.
  history: unknown[];
}
