export interface Notification {
  id: number;
  title: string;
  message: string;
  category: string;
  priority: string;
  read: boolean;
  linkPath: string | null;
  relatedIssueId: number | null;
  relatedIssueNote: string | null;
  relatedStoreName: string | null;
  relatedIssueStatus: string | null;
  storeId?: number | null;
  createdAt: string;
  // Present on STOCK_RECEIPT_REQUEST notifications.
  receiptRequest?: StockReceiptRequest | null;
  // Present on MISSED_END_OF_DAY notifications.
  missedEod?: MissedEndOfDay | null;
}

export type MissedEndOfDayStatus = 'PENDING' | 'COUNTED' | 'COULD_NOT_COUNT';

// One item counted at Start of Day with no End of Day, and where it stands now.
export interface MissedEndOfDayItem {
  storeInventoryItemId: number;
  itemName: string;
  unitOfMeasurement: string;
  startOfDayUsable: number | null;
  status: MissedEndOfDayStatus;
  endOfDayAvailable: number | null;
  endOfDayDeadStock: number | null;
  answeredByName: string | null;
  answeredAt: string | null;
  // Only for COULD_NOT_COUNT.
  reason: string | null;
  imageId: number | null;
}

export interface MissedEndOfDay {
  date: string;
  items: MissedEndOfDayItem[];
}

export type StockReceiptRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// NEW_STOCK: reported stock that isn't on any order. EXISTING_ORDER: an
// Ordered order the employee says arrived (the order* fields identify it).
export interface StockReceiptRequest {
  id: number;
  kind: 'NEW_STOCK' | 'EXISTING_ORDER' | 'LOWER_COUNT';
  status: StockReceiptRequestStatus;
  itemName: string;
  unit: string;
  quantity: number;
  checkDate: string;
  requestedByName: string;
  storeName: string;
  orderId: number | null;
  orderedQuantity: number | null;
  orderSupplierName: string | null;
  orderedAt: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  type?: 'RESTOCK' | 'LOWER_COUNT';
  snapshot?: 'START_OF_DAY' | 'END_OF_DAY';
  reason?: string | null;
  decisionNote?: string | null;
}
