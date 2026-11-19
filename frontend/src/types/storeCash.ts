// Mirrors the backend's DailyCashEntryRequest / DailyCashEntryResponse.
// Amounts are BigDecimal on the server and plain numbers here. Opening drawer
// cash, cash removed and cash remaining may each be null (not recorded yet);
// other adjustments is signed and defaults to 0.

export type CashAmountField =
  | 'openingDrawerCash'
  | 'cashRemoved'
  | 'cashRemaining'
  | 'otherAdjustments';

export type CashAmounts = Record<CashAmountField, number>;

// Only the amounts being saved are sent; one left out is left as it was. That
// is how the employee page saves the opening drawer cash on its own.
export interface DailyCashEntryRequest extends Partial<CashAmounts> {
  // YYYY-MM-DD; the server defaults to today when omitted.
  businessDate: string;
  // Required by the server when this changes an entry that already exists.
  correctionReason?: string;
}

// One direct correction of an entry, oldest first. The new values and reason
// are null only on corrections saved before they were recorded.
export interface DailyCashCorrection {
  id: number;
  previousOpeningDrawerCash: number | null;
  previousCashRemoved: number | null;
  previousCashRemaining: number | null;
  previousOtherAdjustments: number;
  newOpeningDrawerCash: number | null;
  newCashRemoved: number | null;
  newCashRemaining: number | null;
  newOtherAdjustments: number | null;
  correctedByName: string | null;
  correctedAt: string;
  reason: string | null;
}

export interface DailyCashEntry {
  id: number;
  // null until recorded.
  openingDrawerCash: number | null;
  cashRemoved: number | null;
  cashRemaining: number | null;
  otherAdjustments: number;
  storeId: number;
  businessDate: string;
  enteredByUserId: number | null;
  enteredBySuperAdminId: number | null;
  // Display name of whoever first created the entry; null for entries from
  // before the creator was recorded, which the page shows as "Unknown".
  enteredByName: string | null;
  enteredAt: string;
  updatedByUserId: number | null;
  updatedBySuperAdminId: number | null;
  updatedByName: string | null;
  updatedAt: string;
  // Corrections of the entry, oldest first; empty until the first correction.
  history: DailyCashCorrection[];
  // The latest correction, for "Corrected by [name]"; null if never corrected.
  correctedByName: string | null;
  correctedAt: string | null;
  // Who made that correction: shown as "Corrected by employee [name]".
  correctedByRole: CashActorRole | null;
  // Flagged wins while a flag is open.
  status: CashEntryStatus;
  // The open flag, or null.
  flag: CashFlag | null;
  // The latest flag once closed (e.g. fixed by the employee), or null.
  resolvedFlag: CashFlag | null;
  // Employee responses only (null for admins): may this employee edit right now?
  canEdit: boolean | null;
  // Owner/Admin and Super Admin responses only; null for employees.
  dailyExpectedCash?: number | null;
  expectedCashOnHand?: number | null;
}

export type CashActorRole = 'EMPLOYEE' | 'OWNER_ADMIN' | 'SUPER_ADMIN';
export type CashEntryStatus = 'Entered' | 'Corrected' | 'Flagged';

export interface CashFlag {
  id: number;
  comment: string;
  flaggedByName: string | null;
  flaggedByRole: CashActorRole | null;
  flaggedAt: string;
  commentUpdatedAt: string | null;
  resolvedByName: string | null;
  resolvedAt: string | null;
  // REMOVED, CORRECTED or EMPLOYEE_FIXED; null while open.
  resolution: 'REMOVED' | 'CORRECTED' | 'EMPLOYEE_FIXED' | null;
  // The employee's optional note when they fixed it.
  resolutionNote: string | null;
}

// Expected cash on hand as of a date: the server's running sum of each day's
// expected cash. Never computed in the browser.
export interface ExpectedCashAsOf {
  storeId: number;
  asOf: string;
  expectedCashOnHand: number;
}

export type CashHistoryEventType =
  | 'CREATED'
  | 'EMPLOYEE_EDIT'
  | 'ADMIN_CORRECTION'
  | 'FLAGGED'
  | 'FLAG_EDITED'
  | 'FLAG_RESOLVED'
  | 'FLAG_REMOVED';

export interface CashFigures {
  openingDrawerCash: number | null;
  cashRemoved: number | null;
  cashRemaining: number | null;
  otherAdjustments: number;
}

export interface CashHistoryEvent {
  entryId: number;
  businessDate: string;
  type: CashHistoryEventType;
  // Null = unknown (an entry from before the creator was recorded).
  actorName: string | null;
  actorRole: CashActorRole | null;
  at: string;
  previous: CashFigures | null;
  current: CashFigures | null;
  comment: string | null;
}

export interface CashHistory {
  storeId: number;
  from: string;
  to: string;
  events: CashHistoryEvent[];
}

export type CashHistoryStatusFilter = 'ALL' | 'OPEN' | 'RESOLVED';


