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
  storeId: number | null;
  createdAt: string;
  // Present on STOCK_RECEIPT_REQUEST notifications.
  receiptRequest?: StockReceiptRequest | null;
}

export type StockReceiptRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// NEW_STOCK: reported stock that isn't on any order. EXISTING_ORDER: an
// Ordered order the employee says arrived (the order* fields identify it).
export interface StockReceiptRequest {
  id: number;
  kind: 'NEW_STOCK' | 'EXISTING_ORDER';
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
}
