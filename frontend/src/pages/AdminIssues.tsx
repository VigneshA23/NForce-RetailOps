import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { getIssues, updateIssueStatus } from '../api/issues';
import type { Issue } from '../types/issue';
import StatCard from '../components/StatCard';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import './AdminIssues.css';

type StatusFilter = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | null;

const STATUS_BADGE: Record<Issue['status'], string> = {
  OPEN: 'badge--danger',
  ACKNOWLEDGED: 'badge--warning',
  RESOLVED: 'badge--success',
};

const STATUS_LABEL: Record<Issue['status'], string> = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  RESOLVED: 'Resolved',
};

const STATUS_GROUPS: Array<{ status: NonNullable<StatusFilter>; label: string }> = [
  { status: 'OPEN', label: 'Open' },
  { status: 'ACKNOWLEDGED', label: 'Acknowledged' },
  { status: 'RESOLVED', label: 'Resolved' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

interface AdminIssuesProps {
  storeId: number | null;
}

interface ResolveModalProps {
  issue: Issue;
  onCancel: () => void;
  onConfirm: (responseText: string) => void;
  busy: boolean;
}

function ResolveModal({ issue, onCancel, onConfirm, busy }: ResolveModalProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  return (
    <div className="issues-modal-backdrop" onClick={onCancel}>
      <div className="issues-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Resolve issue">
        <div className="issues-modal__header">
          <span className="issues-modal__title">Resolve Issue</span>
          <button type="button" className="issues-modal__close" onClick={onCancel} aria-label="Cancel">
            <X size={16} />
          </button>
        </div>
        <p className="issues-modal__note">{issue.note}</p>
        <textarea
          ref={textareaRef}
          className="input issues-modal__input"
          placeholder="Optional response to employee…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
        />
        <div className="issues-modal__footer">
          <button type="button" className="btn btn--secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onConfirm(text)} disabled={busy}>
            {busy ? 'Resolving…' : 'Confirm Resolve'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminIssues({ storeId }: AdminIssuesProps) {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [resolveModalId, setResolveModalId] = useState<number | null>(null);

  function loadIssues() {
    if (!storeId) return;
    setIsLoading(true);
    setLoadError(null);
    getIssues(storeId)
      .then(setIssues)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'Failed to load issues'))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { loadIssues(); }, [storeId]);

  const openCount = useMemo(() => issues.filter((i) => i.status === 'OPEN').length, [issues]);
  const acknowledgedCount = useMemo(() => issues.filter((i) => i.status === 'ACKNOWLEDGED').length, [issues]);
  const resolvedCount = useMemo(() => issues.filter((i) => i.status === 'RESOLVED').length, [issues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (statusFilter !== null && issue.status !== statusFilter) return false;
      if (q) {
        return (
          issue.employeeFullName.toLowerCase().includes(q) ||
          issue.note.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [issues, statusFilter, search]);

  async function handleAcknowledge(issue: Issue) {
    setBusyId(issue.id);
    try {
      const updated = await updateIssueStatus(issue.id, 'ACKNOWLEDGED');
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      nfToast.success('Issue acknowledged.');
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Failed to acknowledge issue');
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolveConfirm(issue: Issue, responseText: string) {
    setBusyId(issue.id);
    try {
      const updated = await updateIssueStatus(issue.id, 'RESOLVED', responseText || undefined);
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      setResolveModalId(null);
      nfToast.success('Issue resolved.');
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Failed to resolve issue');
    } finally {
      setBusyId(null);
    }
  }

  const resolveIssue = issues.find((i) => i.id === resolveModalId) ?? null;
  const showActionsCol = statusFilter !== 'RESOLVED';

  function renderRow(issue: Issue) {
    return (
      <tr key={issue.id}>
        <td data-label="Employee">{issue.employeeFullName}</td>
        <td data-label="Issue">
          <span className="admin-issues-page__note">{issue.note}</span>
          {issue.responseText && (
            <span className="admin-issues-page__response">Response: {issue.responseText}</span>
          )}
        </td>
        <td data-label="Raised" className="admin-issues-page__date-cell">
          <span>{formatDate(issue.raisedDate)}</span>
          <span className="admin-issues-page__time">{formatTime(issue.raisedDate)}</span>
        </td>
        <td data-label="Status">
          <span className={`badge ${STATUS_BADGE[issue.status]}`}>{STATUS_LABEL[issue.status]}</span>
        </td>
        {showActionsCol && (
          <td data-label="Actions" className="admin-issues-page__action-col">
            {issue.status === 'RESOLVED' ? (
              <span className="admin-issues-page__resolved-label">—</span>
            ) : (
              <div className="admin-issues-page__actions">
                {issue.status === 'OPEN' && statusFilter !== 'ACKNOWLEDGED' && (
                  <button
                    type="button"
                    className="btn btn--secondary btn--sm"
                    disabled={busyId === issue.id}
                    onClick={() => handleAcknowledge(issue)}
                  >
                    Acknowledge
                  </button>
                )}
                {issue.status === 'ACKNOWLEDGED' && statusFilter !== 'OPEN' && (
                  <button
                    type="button"
                    className="btn btn--primary btn--sm"
                    disabled={busyId === issue.id}
                    onClick={() => setResolveModalId(issue.id)}
                  >
                    Resolve
                  </button>
                )}
              </div>
            )}
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="admin-issues-page">
      <div className="stat-card-row">
        <StatCard icon={AlertTriangle} label="Open" value={openCount} tone="primary"
          onClick={() => setStatusFilter(statusFilter === 'OPEN' ? null : 'OPEN')}
          active={statusFilter === 'OPEN'} />
        <StatCard icon={Clock} label="Acknowledged" value={acknowledgedCount} tone="warning"
          onClick={() => setStatusFilter(statusFilter === 'ACKNOWLEDGED' ? null : 'ACKNOWLEDGED')}
          active={statusFilter === 'ACKNOWLEDGED'} />
        <StatCard icon={CheckCircle2} label="Resolved" value={resolvedCount} tone="success"
          onClick={() => setStatusFilter(statusFilter === 'RESOLVED' ? null : 'RESOLVED')}
          active={statusFilter === 'RESOLVED'} />
      </div>

      {loadError && (
        <div className="owners-page__error">
          <AlertCircle size={18} className="owners-page__error-icon" aria-hidden="true" />
          <span className="owners-page__error-message">{loadError}</span>
          <button type="button" className="btn btn--secondary" onClick={loadIssues}>Retry</button>
        </div>
      )}

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search employee or issue…" variant="filter" />
        </div>
        <div className="filter">
          <Select
            options={[
              { value: '', label: 'All Status' },
              { value: 'OPEN', label: 'Open' },
              { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
              { value: 'RESOLVED', label: 'Resolved' },
            ]}
            value={statusFilter ?? ''}
            onChange={(val) => setStatusFilter(val === '' ? null : val as NonNullable<StatusFilter>)}
            ariaLabel="Filter by status"
          />
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Employee</th>
                <th scope="col">Issue</th>
                <th scope="col">Raised</th>
                <th scope="col">Status</th>
                {showActionsCol && <th scope="col" className="admin-issues-page__action-col">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {statusFilter !== null ? (
                filtered.map(renderRow)
              ) : (
                STATUS_GROUPS.map(({ status, label }) => {
                  const group = filtered.filter((i) => i.status === status);
                  if (group.length === 0) return null;
                  return (
                    <Fragment key={status}>
                      <tr className="issues-group-header-row">
                        <td colSpan={5} className="issues-group-header-cell">
                          <span className={`badge ${STATUS_BADGE[status]}`}>{label}</span>
                          <span className="issues-group-count">{group.length}</span>
                        </td>
                      </tr>
                      {group.map(renderRow)}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && filtered.length === 0 && (
          <div className="table-card__empty">
            {issues.length === 0 ? 'No issues have been raised yet.' : 'No issues match your filters.'}
          </div>
        )}
        {isLoading && <div className="table-card__empty">Loading issues…</div>}
      </div>

      {resolveIssue && (
        <ResolveModal
          issue={resolveIssue}
          busy={busyId === resolveIssue.id}
          onCancel={() => setResolveModalId(null)}
          onConfirm={(text) => handleResolveConfirm(resolveIssue, text)}
        />
      )}
    </div>
  );
}

export default AdminIssues;
