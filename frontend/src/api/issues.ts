import { apiRequest } from './client';
import type { Issue } from '../types/issue';

export async function raiseIssue(storeId: number, note: string): Promise<Issue> {
  return apiRequest<Issue>('/me/issues', { method: 'POST', body: { storeId, note } });
}

export async function getIssues(storeId: number): Promise<Issue[]> {
  return apiRequest<Issue[]>(`/issues?storeId=${storeId}`);
}

export async function getMyIssues(storeId: number): Promise<Issue[]> {
  return apiRequest<Issue[]>(`/me/issues?storeId=${storeId}`);
}

export async function updateIssueStatus(
  issueId: number,
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED',
  responseText?: string
): Promise<Issue> {
  return apiRequest<Issue>(`/issues/${issueId}/status`, {
    method: 'PATCH',
    body: { status, responseText: responseText ?? null },
  });
}
