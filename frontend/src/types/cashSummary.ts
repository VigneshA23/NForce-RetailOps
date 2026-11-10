// Mirrors the backend's MonthlyCashSummaryResponse / StoreMonthlyCashSummary
// (RTS-297). Every amount is null when the column recorded no days, so "no
// data" is never shown as $0.00.

export interface StoreMonthlyCashSummary {
  // Null for the Combined column.
  storeId: number | null;
  storeName: string;
  storeCode: number | null;
  daysRecorded: number;
  // Last day in the month with an entry; expected/actual/variance are as at this day.
  asOfDate: string | null;
  totalCashSales: number | null;
  totalCashRemoved: number | null;
  bankDeposits: number | null;
  cashExpenses: number | null;
  adjustments: number | null;
  expectedCashOnHand: number | null;
  actualCashCount: number | null;
  variance: number | null;
  // Sum of every day's over/short in the month.
  netDailyVariance: number | null;
}

export interface MonthlyCashSummary {
  month: string; // YYYY-MM
  periodStart: string;
  periodEnd: string;
  stores: StoreMonthlyCashSummary[];
  combined: StoreMonthlyCashSummary;
}
