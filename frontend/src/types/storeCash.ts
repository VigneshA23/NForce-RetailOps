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
  // Required by the server when this changes an entry that already exists.
  correctionReason?: string;
}

// One direct correction of an entry, oldest first. The new values and reason
// are null only on corrections saved before they were recorded.
export interface DailyCashCorrection {
  id: number;
  previousTotalCashSales: number;
  previousOpeningDrawerCash: number;
  previousCashRemoved: number;
  previousCashRemaining: number;
  previousCashExpenses: number;
  previousBankDeposits: number;
  previousOtherAdjustments: number;
  newTotalCashSales: number | null;
  newOpeningDrawerCash: number | null;
  newCashRemoved: number | null;
  newCashRemaining: number | null;
  newCashExpenses: number | null;
  newBankDeposits: number | null;
  newOtherAdjustments: number | null;
  correctedByName: string | null;
  correctedAt: string;
  reason: string | null;
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
  // Corrections of the entry, oldest first; empty until the first correction.
  history: DailyCashCorrection[];
  // The latest correction, for "Corrected by [name]"; null if never corrected.
  correctedByName: string | null;
  correctedAt: string | null;
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
