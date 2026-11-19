// Mirrors the backend's MonthlyCashSummaryResponse / StoreMonthlyCashSummary
// (RTS-297). Every amount is null when the column recorded no days, so "no
// data" is never shown as $0.00.

// One recorded business date. Opening drawer and cash removed are recorded
// figures only; cash remaining is what was dropped into the safe. The server
// computes dailyExpected (cash remaining +/- adjustments) and the running
// expectedCashOnHand; the UI renders them and never recomputes. A figure nobody
// entered is null.
export interface DailyCashBreakdown {
  businessDate: string; // YYYY-MM-DD
  openingDrawerCash: number | null;
  cashRemoved: number | null;
  cashRemaining: number | null;
  adjustments: number;
  dailyExpected: number;
  expectedCashOnHand: number;
}

export interface StoreMonthlyCashSummary {
  // Null for the Combined column.
  storeId: number | null;
  storeName: string;
  storeCode: number | null;
  daysRecorded: number;
  // Last day in the month with an entry; expected cash on hand is as at this day.
  asOfDate: string | null;
  // Recorded only; not part of expected cash.
  totalCashRemoved: number | null;
  // Dropped into the safe, summed over the month.
  totalCashRemaining: number | null;
  adjustments: number | null;
  expectedCashOnHand: number | null;
  // Recorded days only, oldest first. Empty when no entries and for Combined.
  dailyBreakdown: DailyCashBreakdown[];
}

export interface MonthlyCashSummary {
  month: string; // YYYY-MM
  periodStart: string;
  periodEnd: string;
  stores: StoreMonthlyCashSummary[];
  combined: StoreMonthlyCashSummary;
}
