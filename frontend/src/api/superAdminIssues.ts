import { apiRequest } from './client';

export interface SAIssue {
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

export async function getSAIssues(status?: string): Promise<SAIssue[]> {
  const params = status ? `?status=${encodeURIComponent(status)}` : '';
  return apiRequest<SAIssue[]>(`/admin/issues${params}`);
}

export async function updateSAIssueStatus(
  issueId: number,
  status: 'ACKNOWLEDGED' | 'RESOLVED',
  responseText?: string
): Promise<SAIssue> {
  return apiRequest<SAIssue>(`/admin/issues/${issueId}/status`, {
    method: 'PATCH',
    body: { status, responseText: responseText ?? null },
  });
}

export async function nudgeOwner(issueId: number): Promise<void> {
  return apiRequest<void>(`/admin/issues/${issueId}/nudge`, { method: 'POST' });
}
