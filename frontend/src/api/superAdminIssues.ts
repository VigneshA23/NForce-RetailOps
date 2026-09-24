import { apiRequest } from './client';
import type { Issue } from '../types/issue';

// Same shape as the owner-facing Issue -- both come from IssueResponse.
export type SAIssue = Issue;

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

// Rejected with 409 if the issue is resolved or the store has no active
// owner, and 429 if the owner was already nudged in the last 24 hours --
// the ApiError message says which.
export async function nudgeOwner(issueId: number): Promise<void> {
  return apiRequest<void>(`/admin/issues/${issueId}/nudge`, { method: 'POST' });
}
