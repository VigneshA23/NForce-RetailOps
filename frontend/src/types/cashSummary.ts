// Mirrors the backend's MonthlyCashSummaryResponse / StoreMonthlyCashSummary
// (RTS-297). Every amount is null when the column recorded no days, so "no
// data" is never shown as $0.00.

// One recorded business date, exactly as the backend's shared Expected Cash on
// Hand calculation produced it. The UI renders these; it never recomputes them.
export interface DailyCashBreakdown {
  businessDate: string; // YYYY-MM-DD
  openingDrawerCash: number;
  cashRemoved: number;
  cashExpenses: number;
  adjustments: number;
  expectedCash: number;
  // The counted cash: the "actual cash count".
  cashRemaining: number;
  variance: number;
}

export interface StoreMonthlyCashSummary {
  // Null for the Combined column.
  storeId: number | null;
  storeName: string;
  storeCode: number | null;
  daysRecorded: number;
  // Last day in the month with an entry; expected/actual/variance are as at this day.
  asOfDate: string | null;
  totalCashRemoved: number | null;
  cashExpenses: number | null;
  adjustments: number | null;
  expectedCashOnHand: number | null;
  actualCashCount: number | null;
  variance: number | null;
  // Sum of every day's over/short in the month.
  netDailyVariance: number | null;
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
