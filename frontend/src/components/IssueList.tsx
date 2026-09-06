import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import type { Issue } from '../types/issue';
import './IssueList.css';

interface IssueListProps {
  issues: Issue[];
  onUpdateStatus: (issueId: number, status: 'ACKNOWLEDGED' | 'RESOLVED', responseText?: string) => Promise<void>;
}

function statusBadge(status: Issue['status']) {
  if (status === 'OPEN') return <span className="issue-badge issue-badge--open"><AlertTriangle size={11} /> Open</span>;
  if (status === 'ACKNOWLEDGED') return <span className="issue-badge issue-badge--acknowledged"><Clock size={11} /> Acknowledged</span>;
  return <span className="issue-badge issue-badge--resolved"><CheckCircle2 size={11} /> Resolved</span>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

interface IssueRowProps {
  issue: Issue;
  onUpdateStatus: IssueListProps['onUpdateStatus'];
}

function IssueRow({ issue, onUpdateStatus }: IssueRowProps) {
  const [busy, setBusy] = useState(false);
  const [showResolveInput, setShowResolveInput] = useState(false);
  const [responseText, setResponseText] = useState('');

  async function handleAcknowledge() {
    setBusy(true);
    try { await onUpdateStatus(issue.id, 'ACKNOWLEDGED'); } finally { setBusy(false); }
  }

  async function handleResolve() {
    if (!showResolveInput) { setShowResolveInput(true); return; }
    setBusy(true);
    try {
      await onUpdateStatus(issue.id, 'RESOLVED', responseText || undefined);
      setShowResolveInput(false);
      setResponseText('');
    } finally { setBusy(false); }
  }

  return (
    <div className={`issue-row issue-row--${issue.status.toLowerCase()}`}>
      <div className="issue-row__header">
        <div className="issue-row__meta">
          <span className="issue-row__employee">{issue.employeeFullName}</span>
          <span className="issue-row__date">{formatDate(issue.raisedDate)}</span>
        </div>
        {statusBadge(issue.status)}
      </div>
      <p className="issue-row__note">{issue.note}</p>
      {issue.status === 'RESOLVED' && issue.responseText && (
        <p className="issue-row__response">
          <span className="issue-row__response-label">Response:</span> {issue.responseText}
          {issue.respondedByFullName && (
            <span className="issue-row__responded-by"> — {issue.respondedByFullName}</span>
          )}
        </p>
      )}
      {showResolveInput && (
        <textarea
          className="issue-row__response-input"
          placeholder="Optional response to the employee…"
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          rows={2}
        />
      )}
      {issue.status !== 'RESOLVED' && (
        <div className="issue-row__actions">
          {issue.status === 'OPEN' && (
            <button type="button" className="issue-btn issue-btn--secondary" disabled={busy} onClick={handleAcknowledge}>
              Acknowledge
            </button>
          )}
          <button type="button" className="issue-btn issue-btn--primary" disabled={busy} onClick={handleResolve}>
            {showResolveInput ? 'Confirm Resolve' : 'Resolve'}
          </button>
          {showResolveInput && (
            <button type="button" className="issue-btn issue-btn--ghost" onClick={() => { setShowResolveInput(false); setResponseText(''); }}>
              Cancel
            </button>
          )}
        </div>
      )}
    </div>
  );
}

type Tab = 'active' | 'resolved' | 'all';

function IssueList({ issues, onUpdateStatus }: IssueListProps) {
  const [tab, setTab] = useState<Tab>('active');

  const active = issues.filter((i) => i.status === 'OPEN' || i.status === 'ACKNOWLEDGED');
  const resolved = issues.filter((i) => i.status === 'RESOLVED');

  const visible = tab === 'active' ? active : tab === 'resolved' ? resolved : issues;

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: active.length },
    { id: 'resolved', label: 'Resolved', count: resolved.length },
    { id: 'all', label: 'All', count: issues.length },
  ];

  if (issues.length === 0) {
    return (
      <div className="issue-list-empty">
        <CheckCircle2 size={32} className="issue-list-empty__icon" />
        <p>No issues raised by employees.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="issue-tabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`issue-tab${tab === t.id ? ' issue-tab--active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
            {t.count > 0 && <span className="issue-tab__count">{t.count}</span>}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="issue-list-empty">
          <CheckCircle2 size={24} className="issue-list-empty__icon" />
          <p>No {tab === 'active' ? 'active' : 'resolved'} issues.</p>
        </div>
      ) : (
        <div className="issue-list">
          {visible.map((issue) => (
            <IssueRow key={issue.id} issue={issue} onUpdateStatus={onUpdateStatus} />
          ))}
        </div>
      )}
    </div>
  );
}

export default IssueList;
