// Super Admin cash review payload: what the server returns for one
// (store, date). Amounts stay strings because the backend serializes
// BigDecimal -- parsing them to Number here would lose precision.

export type CashActorKind = 'EMPLOYEE' | 'OWNER_ADMIN' | 'SUPER_ADMIN';

export interface CashActor {
  id: number;
  name: string;
  kind: CashActorKind;
}

export type CashEntryStatus = 'Entered' | 'Corrected' | 'Flagged';

export interface SuperAdminCashReviewEntry {
  id: number;
  storeId: number;
  businessDate: string;
  openingDrawerCash: string;
  cashExpenses: string;
  cashRemoved: string;
  cashRemaining: string;
  otherAdjustments: string;
  totalCashSales: string;
  bankDeposits: string;
  enteredBy: CashActor | null;
  enteredAt: string;
  updatedBy: CashActor | null;
  updatedAt: string;
  status: CashEntryStatus;
}

export interface SuperAdminCashReviewFlag {
  id: number;
  comment: string;
  flaggedBy: CashActor | null;
  flaggedAt: string;
  commentUpdatedAt: string | null;
}

export interface SuperAdminCashReviewCorrection {
  id: number;
  previousOpeningDrawerCash: string;
  previousCashExpenses: string;
  previousCashRemoved: string;
  previousCashRemaining: string;
  previousOtherAdjustments: string;
  previousTotalCashSales: string;
  previousBankDeposits: string;
  correctedBy: CashActor | null;
  correctedAt: string;
  reason: string | null;
}

export interface SuperAdminCashReview {
  storeId: number;
  storeName: string;
  storeCode: string;
  date: string;
  cashTarget: string;
  expectedCashOnHand: string;
  entry: SuperAdminCashReviewEntry | null;
  flag: SuperAdminCashReviewFlag | null;
  history: SuperAdminCashReviewCorrection[];
}

export interface SuperAdminCashCorrectionRequest {
  openingDrawerCash: number;
  cashExpenses: number;
  cashRemoved: number;
  cashRemaining: number;
  otherAdjustments: number;
  reason: string;
}

export interface SuperAdminCashFlagRequest {
  comment: string;
}
