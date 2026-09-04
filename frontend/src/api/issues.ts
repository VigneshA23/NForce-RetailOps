import { apiRequest } from './client';

export type IssueStatus = 'OPEN' | 'RESOLVED';

export interface Issue {
  id: number;
  storeId: number;
  employeeUserId: number;
  employeeName: string;
  note: string;
  status: IssueStatus;
  responseText: string | null;
  respondedByName: string | null;
  respondedAt: string | null;
  createdAt: string;
}

export async function getStoreIssues(storeId: number): Promise<Issue[]> {
  return apiRequest<Issue[]>(`/stores/${storeId}/issues`);
}

export async function respondToIssue(storeId: number, issueId: number, responseText: string): Promise<Issue> {
  return apiRequest<Issue>(`/stores/${storeId}/issues/${issueId}/respond`, {
    method: 'POST',
    body: { responseText },
  });
}
