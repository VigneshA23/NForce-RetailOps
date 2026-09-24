import { AlertTriangle, CheckCircle2, Clock, type LucideIcon } from 'lucide-react';
import type { StatCardTone } from '../components/StatCard';
import type { Issue, IssueStatus } from '../types/issue';

// Single source of truth for how an issue status is displayed, shared by the
// Employee, Owner/Admin and Super Admin Issues pages so the three can't drift
// into different colors/labels for the same state.
export interface IssueStatusMeta {
  label: string;
  badgeClass: string;
  tone: StatCardTone;
  icon: LucideIcon;
}

export const ISSUE_STATUS_META: Record<IssueStatus, IssueStatusMeta> = {
  OPEN: { label: 'Open', badgeClass: 'badge--danger', tone: 'primary', icon: AlertTriangle },
  ACKNOWLEDGED: { label: 'Acknowledged', badgeClass: 'badge--warning', tone: 'warning', icon: Clock },
  RESOLVED: { label: 'Resolved', badgeClass: 'badge--success', tone: 'success', icon: CheckCircle2 },
};

export const ISSUE_STATUSES: IssueStatus[] = ['OPEN', 'ACKNOWLEDGED', 'RESOLVED'];

// Mirrors the backend's @Size limits (RaiseIssueRequest.note,
// UpdateIssueStatusRequest.responseText) so the UI stops input at the limit
// instead of surfacing a 400 after the user hits Send.
export const ISSUE_NOTE_MAX_LENGTH = 1000;
export const ISSUE_RESPONSE_MAX_LENGTH = 500;

// 'ACTIVE' = anything not yet resolved (Open + Acknowledged); null = all.
export type IssueStatusFilter = 'ACTIVE' | IssueStatus | null;

export const ISSUE_STATUS_FILTER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'ACTIVE', label: 'Active' },
  { value: 'OPEN', label: 'Open' },
  { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { value: 'RESOLVED', label: 'Resolved' },
  { value: '', label: 'All Status' },
];

export function parseIssueStatusFilter(value: string): IssueStatusFilter {
  return value === '' ? null : (value as NonNullable<IssueStatusFilter>);
}

export function matchesIssueStatusFilter(issue: Pick<Issue, 'status'>, filter: IssueStatusFilter): boolean {
  if (filter === null) return true;
  if (filter === 'ACTIVE') return issue.status !== 'RESOLVED';
  return issue.status === filter;
}

// Always format from the full `createdAt` timestamp -- `raisedDate` is a bare
// LocalDate ("2026-09-24"), which `new Date()` parses as UTC midnight and so
// renders as the previous day (with a bogus evening time) west of UTC.
export function formatIssueDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatIssueTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
