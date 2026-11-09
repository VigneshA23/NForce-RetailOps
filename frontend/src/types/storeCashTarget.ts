// Mirrors the backend's StoreCashTargetResponse (RTS-293).
export interface StoreCashTarget {
  storeId: number;
  targetAmount: number;
  // Both null while the store is still on the default target (never set
  // explicitly); otherwise exactly one names who last changed it.
  updatedByUserId: number | null;
  updatedBySuperAdminId: number | null;
  updatedAt: string;
}

export function isDefaultTarget(target: StoreCashTarget): boolean {
  return target.updatedByUserId === null && target.updatedBySuperAdminId === null;
}
