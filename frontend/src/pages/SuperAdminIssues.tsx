import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Bell, CheckCircle2, Clock, X } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { getSAIssues, nudgeOwner, updateSAIssueStatus, type SAIssue } from '../api/superAdminIssues';
import StatCard from '../components/StatCard';
import SearchInput from '../components/SearchInput';
import Select from '../components/Select';
import './SuperAdminIssues.css';

type StatusFilter = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | null;

const STATUS_BADGE: Record<SAIssue['status'], string> = {
  OPEN: 'badge--danger',
  ACKNOWLEDGED: 'badge--warning',
  RESOLVED: 'badge--success',
};

const STATUS_LABEL: Record<SAIssue['status'], string> = {
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

interface ResolveModalProps {
  issue: SAIssue;
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

function SuperAdminIssues() {
  const [issues, setIssues] = useState<SAIssue[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('OPEN');
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [search, setSearch] = useState('');
  const [nudgingId, setNudgingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [resolveModalId, setResolveModalId] = useState<number | null>(null);

  function loadIssues() {
    setIsLoading(true);
    setLoadError(null);
    getSAIssues()
      .then(setIssues)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'Failed to load issues'))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => { loadIssues(); }, []);

  const storeNames = useMemo(() => {
    const names = [...new Set(issues.map((i) => i.storeName))].sort();
    return names;
  }, [issues]);

  const openCount = useMemo(() => issues.filter((i) => i.status === 'OPEN').length, [issues]);
  const acknowledgedCount = useMemo(() => issues.filter((i) => i.status === 'ACKNOWLEDGED').length, [issues]);
  const resolvedCount = useMemo(() => issues.filter((i) => i.status === 'RESOLVED').length, [issues]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issues.filter((issue) => {
      if (statusFilter !== null && issue.status !== statusFilter) return false;
      if (storeFilter && issue.storeName !== storeFilter) return false;
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
      nfToast.success(`Nudge sent to ${issue.storeName} owner.`);
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Failed to send nudge');
    } finally {
      setNudgingId(null);
    }
  }

  async function handleAcknowledge(issue: SAIssue) {
    setBusyId(issue.id);
    try {
      const updated = await updateSAIssueStatus(issue.id, 'ACKNOWLEDGED');
      setIssues((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
      nfToast.success('Issue acknowledged.');
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Failed to acknowledge issue');
    } finally {
      setBusyId(null);
    }
  }

  async function handleResolveConfirm(issue: SAIssue, responseText: string) {
    setBusyId(issue.id);
    try {
      const updated = await updateSAIssueStatus(issue.id, 'RESOLVED', responseText || undefined);
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

  function renderRow(issue: SAIssue) {
    return (
      <tr key={issue.id}>
        <td data-label="Store">
          <span className="sa-issues-page__store-name">{issue.storeName}</span>
        </td>
        <td data-label="Employee">{issue.employeeFullName}</td>
        <td data-label="Issue">
          <span className="sa-issues-page__note">{issue.note}</span>
          {issue.responseText && (
            <span className="sa-issues-page__response">Response: {issue.responseText}</span>
          )}
        </td>
        <td data-label="Raised" className="sa-issues-page__date-cell">
          <span>{formatDate(issue.createdAt)}</span>
          <span className="sa-issues-page__time">{formatTime(issue.createdAt)}</span>
        </td>
        <td data-label="Status">
          <span className={`badge ${STATUS_BADGE[issue.status]}`}>{STATUS_LABEL[issue.status]}</span>
        </td>
        {showActionsCol && (
          <td data-label="Actions" className="sa-issues-page__action-col">
            {issue.status === 'RESOLVED' ? (
              <span className="sa-issues-page__resolved-label">—</span>
            ) : (
              <div className="sa-issues-page__actions">
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
                <button
                  type="button"
                  className="btn btn--ghost btn--sm sa-issues-page__nudge-btn"
                  onClick={() => handleNudge(issue)}
                  disabled={nudgingId === issue.id}
                  title="Notify store owner to take action"
                >
                  <Bell size={12} />
                  {nudgingId === issue.id ? 'Sending…' : 'Nudge'}
                </button>
              </div>
            )}
          </td>
        )}
      </tr>
    );
  }

  return (
    <div className="sa-issues-page">
      <div className="stat-card-row">
        <StatCard icon={AlertTriangle} label="Open" value={openCount} tone="primary" />
        <StatCard icon={Clock} label="Acknowledged" value={acknowledgedCount} tone="warning" />
        <StatCard icon={CheckCircle2} label="Resolved" value={resolvedCount} tone="success" />
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
          <SearchInput value={search} onChange={setSearch} placeholder="Search store, employee, or issue…" variant="filter" />
        </div>
        <div className="filter">
          <Select
            options={[
              { value: '', label: 'All Stores' },
              ...storeNames.map((name) => ({ value: name, label: name })),
            ]}
            value={storeFilter}
            onChange={setStoreFilter}
            ariaLabel="Filter by store"
          />
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
                <th scope="col">Store</th>
                <th scope="col">Employee</th>
                <th scope="col">Issue</th>
                <th scope="col">Raised</th>
                <th scope="col">Status</th>
                {showActionsCol && <th scope="col" className="sa-issues-page__action-col">Actions</th>}
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
                        <td colSpan={6} className="issues-group-header-cell">
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

export default SuperAdminIssues;
