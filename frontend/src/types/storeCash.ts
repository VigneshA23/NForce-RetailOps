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

// Mirrors the backend's ExpectedCashResponse (RTS-295): the store's live
// expected cash, derived from its latest saved entry. When `available` is
// false every amount and asOfDate is null -- never a fake zero.
export interface ExpectedCash {
  storeId: number;
  available: boolean;
  message: string | null;
  // YYYY-MM-DD business date of the entry the figure comes from.
  asOfDate: string | null;
  // ISO timestamp of when that entry was last saved (first save or a later
  // correction) -- when the count was entered into the system.
  lastUpdatedAt: string | null;
  expectedCashOnHand: number | null;
  cashRemaining: number | null;
  variance: number | null;
  openingDrawerCash: number | null;
  totalCashSales: number | null;
  cashRemoved: number | null;
  bankDeposits: number | null;
  cashExpenses: number | null;
  otherAdjustments: number | null;
}
