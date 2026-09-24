import { Fragment, useCallback, useMemo, useState } from 'react';
import { AlertCircle, Bell } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { getSAIssues, nudgeOwner, updateSAIssueStatus, type SAIssue } from '../api/superAdminIssues';
import StatCard from '../components/StatCard';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import ButtonDots from '../components/ButtonDots';
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
import './SuperAdminIssues.css';

const CARD_ID_PREFIX = 'sa-issue-row';

interface SuperAdminIssuesProps {
  // Set from a notification click to scroll to and highlight that issue.
  focusIssueId?: IssueFocusRequest;
}

function SuperAdminIssues({ focusIssueId }: SuperAdminIssuesProps) {
  // SuperAdminDashboard unmounts this page when another tab is shown, so it
  // is always "active" while mounted; useIssueList still polls for us.
  const { issues, setIssues, isLoading, error, refresh } = useIssueList<SAIssue>(getSAIssues, true, 'Failed to load issues');

  const [statusFilter, setStatusFilter] = useState<IssueStatusFilter>('ACTIVE');
  // Keyed by storeId, not name -- two stores can share a display name.
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [nudgingId, setNudgingId] = useState<number | null>(null);
  // Nudged this session: the backend enforces a 24h cooldown, this just
  // reflects it on the button without waiting for a rejected click.
  const [nudgedIds, setNudgedIds] = useState<Set<number>>(() => new Set());
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, setPending] = useState<{ issueId: number; action: IssueResponseAction } | null>(null);

  const clearFilters = useCallback(() => { setStatusFilter(null); setStoreFilter(''); setSearch(''); }, []);
  const issueIds = useMemo(() => issues.map((i) => i.id), [issues]);
  const highlightedId = useIssueFocus(focusIssueId, issueIds, CARD_ID_PREFIX, clearFilters);

  const storeOptions = useMemo(() => {
    const byId = new Map<number, string>();
    issues.forEach((i) => byId.set(i.storeId, i.storeName));
    return [...byId.entries()]
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([id, name]) => ({ value: String(id), label: name }));
  }, [issues]);

  const counts = useMemo(() => ({
    OPEN: issues.filter((i) => i.status === 'OPEN').length,
    ACKNOWLEDGED: issues.filter((i) => i.status === 'ACKNOWLEDGED').length,
    RESOLVED: issues.filter((i) => i.status === 'RESOLVED').length,
  }), [issues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (!matchesIssueStatusFilter(issue, statusFilter)) return false;
      if (storeFilter && String(issue.storeId) !== storeFilter) return false;
      if (q) {
        return (
          issue.storeName.toLowerCase().includes(q) ||
          issue.employeeFullName.toLowerCase().includes(q) ||
          issue.note.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [issues, statusFilter, storeFilter, search]);

  async function handleNudge(issue: SAIssue) {
    setNudgingId(issue.id);
    try {
      await nudgeOwner(issue.id);
      setNudgedIds((prev) => new Set(prev).add(issue.id));
      nfToast.success(`Nudge sent to the ${issue.storeName} owner.`);
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Failed to send nudge');
    } finally {
      setNudgingId(null);
    }
  }

  async function handleConfirm(issue: SAIssue, action: IssueResponseAction, responseText: string) {
    setBusyId(issue.id);
    try {
      const updated = await updateSAIssueStatus(issue.id, action, responseText || undefined);
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setPending(null);
      nfToast.success(action === 'RESOLVED'
        ? 'Issue resolved. The employee and store owner have been notified.'
        : 'Issue acknowledged. The employee and store owner have been notified.');
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Failed to update issue');
    } finally {
      setBusyId(null);
    }
  }

  function renderActions(issue: SAIssue) {
    if (issue.status === 'RESOLVED') return undefined;
    const nudged = nudgedIds.has(issue.id);
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
        <button
          type="button"
          className={`btn btn--ghost btn--sm sa-issues-page__nudge-btn${nudgingId === issue.id ? ' btn--loading' : ''}`}
          onClick={() => handleNudge(issue)}
          disabled={nudgingId === issue.id || nudged}
          title={nudged ? 'Owner already nudged — you can nudge again after 24 hours' : 'Notify the store owner to take action'}
        >
          <Bell size={12} />
          {nudgingId === issue.id ? <ButtonDots label="Sending" /> : nudged ? 'Nudged' : 'Nudge owner'}
        </button>
      </>
    );
  }

  function renderCard(issue: SAIssue) {
    return (
      <IssueCard
        key={issue.id}
        issue={issue}
        idPrefix={CARD_ID_PREFIX}
        showStore
        showEmployee
        highlighted={highlightedId === issue.id}
        actions={renderActions(issue)}
      />
    );
  }

  const groupStatuses = statusFilter === null ? ISSUE_STATUSES
    : statusFilter === 'ACTIVE' ? ISSUE_STATUSES.filter((s) => s !== 'RESOLVED')
    : null;

  const pendingIssue = pending ? issues.find((i) => i.id === pending.issueId) ?? null : null;

  function toggleStatus(status: NonNullable<IssueStatusFilter>) {
    setStatusFilter((current) => (current === status ? 'ACTIVE' : status));
  }

  return (
    <div className="sa-issues-page">
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search store, employee, or issue…" variant="filter" />
        </div>
        <div className="filter">
          <Select
            options={[{ value: '', label: 'All Stores' }, ...storeOptions]}
            value={storeFilter}
            onChange={setStoreFilter}
            ariaLabel="Filter by store"
          />
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
        {isLoading && <div className="issue-card-list__empty">Loading issues…</div>}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="issue-card-list__empty">
            {issues.length === 0 ? 'No issues have been raised yet.'
              : statusFilter === 'ACTIVE' && !search && !storeFilter ? 'All caught up — no open issues across stores.'
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

export default SuperAdminIssues;
