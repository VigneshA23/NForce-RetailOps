import { Fragment, useCallback, useMemo, useState } from 'react';
import { AlertCircle, Store as StoreIcon } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { getIssues, updateIssueStatus } from '../api/issues';
import type { Issue } from '../types/issue';
import StatCard from '../components/StatCard';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import IssueCard from '../components/IssueCard';
import IssueResponseModal, { type IssueResponseAction } from '../components/IssueResponseModal';
import { useIssueList } from '../hooks/useIssueList';
import { useIssueFocus, type IssueFocusRequest } from '../hooks/useIssueFocus';
import {
  ISSUE_STATUSES,
  ISSUE_STATUS_FILTER_OPTIONS,
  ISSUE_STATUS_META,
  matchesIssueStatusFilter,
  parseIssueStatusFilter,
  type IssueStatusFilter,
} from '../utils/issueStatusMeta';
import './AdminIssues.css';

const CARD_ID_PREFIX = 'admin-issue-row';

interface AdminIssuesProps {
  storeId: number | null;
  // True while the owner's store list is still being fetched -- storeId is
  // null then too, but that is not the same as "no store linked".
  storesLoading?: boolean;
  // False while this tab is hidden (the shell keeps it mounted) -- see useIssueList.
  isActive?: boolean;
  // Set from a notification click to scroll to and highlight that issue.
  focusIssueId?: IssueFocusRequest;
}

function AdminIssues({ storeId, storesLoading = false, isActive = true, focusIssueId }: AdminIssuesProps) {
  const load = useMemo(() => (storeId ? () => getIssues(storeId) : null), [storeId]);
  const { issues, setIssues, isLoading, error, refresh } = useIssueList<Issue>(load, isActive, 'Failed to load issues');

  const [statusFilter, setStatusFilter] = useState<IssueStatusFilter>('ACTIVE');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, setPending] = useState<{ issueId: number; action: IssueResponseAction } | null>(null);

  const clearFilters = useCallback(() => { setStatusFilter(null); setSearch(''); }, []);
  const issueIds = useMemo(() => issues.map((i) => i.id), [issues]);
  const highlightedId = useIssueFocus(focusIssueId, issueIds, CARD_ID_PREFIX, clearFilters);

  const counts = useMemo(() => ({
    OPEN: issues.filter((i) => i.status === 'OPEN').length,
    ACKNOWLEDGED: issues.filter((i) => i.status === 'ACKNOWLEDGED').length,
    RESOLVED: issues.filter((i) => i.status === 'RESOLVED').length,
  }), [issues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (!matchesIssueStatusFilter(issue, statusFilter)) return false;
      if (q) {
        return (
          issue.employeeFullName.toLowerCase().includes(q) ||
          issue.note.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [issues, statusFilter, search]);

  async function handleConfirm(issue: Issue, action: IssueResponseAction, responseText: string) {
    setBusyId(issue.id);
    try {
      const updated = await updateIssueStatus(issue.id, action, responseText || undefined);
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setPending(null);
      nfToast.success(action === 'RESOLVED' ? 'Issue resolved. The employee has been notified.' : 'Issue acknowledged. The employee has been notified.');
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Failed to update issue');
    } finally {
      setBusyId(null);
    }
  }

  function renderActions(issue: Issue) {
    if (issue.status === 'RESOLVED') return undefined;
    return (
      <>
        {issue.status === 'OPEN' && (
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            disabled={busyId === issue.id}
            onClick={() => setPending({ issueId: issue.id, action: 'ACKNOWLEDGED' })}
          >
            Acknowledge
          </button>
        )}
        <button
          type="button"
          className="btn btn--primary btn--sm"
          disabled={busyId === issue.id}
          onClick={() => setPending({ issueId: issue.id, action: 'RESOLVED' })}
        >
          Resolve
        </button>
      </>
    );
  }

  function renderCard(issue: Issue) {
    return (
      <IssueCard
        key={issue.id}
        issue={issue}
        idPrefix={CARD_ID_PREFIX}
        showEmployee
        highlighted={highlightedId === issue.id}
        actions={renderActions(issue)}
      />
    );
  }

  // Grouped by status unless a single status is selected.
  const groupStatuses = statusFilter === null ? ISSUE_STATUSES
    : statusFilter === 'ACTIVE' ? ISSUE_STATUSES.filter((s) => s !== 'RESOLVED')
    : null;

  const pendingIssue = pending ? issues.find((i) => i.id === pending.issueId) ?? null : null;

  function toggleStatus(status: NonNullable<IssueStatusFilter>) {
    setStatusFilter((current) => (current === status ? 'ACTIVE' : status));
  }

  if (!storeId && !storesLoading) {
    return (
      <div className="admin-issues-page">
        <div className="table-card">
          <div className="table-card__empty">
            <StoreIcon size={20} aria-hidden="true" /> No store is linked to your account yet.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-issues-page">
      <div className="stat-card-row">
        {ISSUE_STATUSES.map((status) => {
          const meta = ISSUE_STATUS_META[status];
          return (
            <StatCard
              key={status}
              icon={meta.icon}
              label={meta.label}
              value={counts[status]}
              tone={meta.tone}
              onClick={() => toggleStatus(status)}
              active={statusFilter === status}
            />
          );
        })}
      </div>

      {error && (
        <div className="owners-page__error">
          <AlertCircle size={18} className="owners-page__error-icon" aria-hidden="true" />
          <span className="owners-page__error-message">{error}</span>
          <button type="button" className="btn btn--secondary" onClick={refresh}>Retry</button>
        </div>
      )}

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employee or issue…" variant="filter" />
        </div>
        <div className="filter">
          <Select
            options={ISSUE_STATUS_FILTER_OPTIONS}
            value={statusFilter ?? ''}
            onChange={(val) => setStatusFilter(parseIssueStatusFilter(val))}
            ariaLabel="Filter by status"
          />
        </div>
      </div>

      <div>
        <div className="issue-card-list">
          {groupStatuses === null ? (
            filtered.map(renderCard)
          ) : (
            groupStatuses.map((status) => {
              const group = filtered.filter((i) => i.status === status);
              if (group.length === 0) return null;
              const meta = ISSUE_STATUS_META[status];
              return (
                <Fragment key={status}>
                  <div className="issues-group-header-cell">
                    <span className={`badge ${meta.badgeClass}`}>{meta.label}</span>
                    <span className="issues-group-count">{group.length}</span>
                  </div>
                  {group.map(renderCard)}
                </Fragment>
              );
            })
          )}
        </div>
        {(isLoading || storesLoading) && <div className="issue-card-list__empty">Loading issues…</div>}
        {!isLoading && !storesLoading && !error && filtered.length === 0 && (
          <div className="issue-card-list__empty">
            {issues.length === 0 ? 'No issues have been raised yet.'
              : statusFilter === 'ACTIVE' && !search ? 'All caught up — no open issues.'
              : 'No issues match your filters.'}
          </div>
        )}
      </div>

      <IssueResponseModal
        issue={pendingIssue}
        action={pending?.action ?? 'RESOLVED'}
        busy={pendingIssue !== null && busyId === pendingIssue.id}
        onCancel={() => setPending(null)}
        onConfirm={(text) => { if (pendingIssue && pending) handleConfirm(pendingIssue, pending.action, text); }}
      />
    </div>
  );
}

export default AdminIssues;
