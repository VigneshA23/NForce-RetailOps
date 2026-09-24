export type IssueStatus = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface Issue {
  id: number;
  storeId: number;
  storeName: string;
  employeeUserId: number;
  employeeFullName: string;
  note: string;
  status: IssueStatus;
  raisedDate: string;
  responseText: string | null;
  respondedByFullName: string | null;
  // True when a Super Admin (rather than the store's owner) made the last
  // status change -- see IssueResponse.respondedBySuperAdmin.
  respondedBySuperAdmin: boolean;
  respondedAt: string | null;
  createdAt: string;
}
