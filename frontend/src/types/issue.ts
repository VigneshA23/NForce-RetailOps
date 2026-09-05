export interface Issue {
  id: number;
  storeId: number;
  storeName: string;
  employeeUserId: number;
  employeeFullName: string;
  note: string;
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';
  raisedDate: string;
  responseText: string | null;
  respondedByFullName: string | null;
  respondedAt: string | null;
  createdAt: string;
}
