import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, MessageSquareWarning } from 'lucide-react'
import { getMyIssues } from '../api/issues'
import type { Issue } from '../types/issue'
import type { StoreSummary } from '../types/store'
import './EmployeeIssues.css'

interface EmployeeIssuesProps {
  store: StoreSummary
}

type Tab = 'active' | 'resolved' | 'all'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function StatusBadge({ status }: { status: Issue['status'] }) {
  if (status === 'OPEN') {
    return (
      <span className="emp-issue-badge emp-issue-badge--open">
        <AlertTriangle size={11} /> Open
      </span>
    )
  }
  if (status === 'ACKNOWLEDGED') {
    return (
      <span className="emp-issue-badge emp-issue-badge--acknowledged">
        <Clock size={11} /> Acknowledged
      </span>
    )
  }
  return (
    <span className="emp-issue-badge emp-issue-badge--resolved">
      <CheckCircle2 size={11} /> Resolved
    </span>
  )
}

function IssueCard({ issue }: { issue: Issue }) {
  return (
    <div className={`emp-issue-card emp-issue-card--${issue.status.toLowerCase()}`}>
      <div className="emp-issue-card__header">
        <span className="emp-issue-card__date">{formatDate(issue.raisedDate)}</span>
        <StatusBadge status={issue.status} />
      </div>
      <p className="emp-issue-card__note">{issue.note}</p>
      {issue.status === 'RESOLVED' && (
        <div className="emp-issue-card__resolution">
          {issue.responseText ? (
            <>
              <span className="emp-issue-card__resolution-label">Admin response:</span>
              <span className="emp-issue-card__resolution-text">{issue.responseText}</span>
              {issue.respondedByFullName && (
                <span className="emp-issue-card__resolution-by">— {issue.respondedByFullName}</span>
              )}
            </>
          ) : (
            <span className="emp-issue-card__resolution-text emp-issue-card__resolution-text--none">
              Resolved — no additional notes from admin.
            </span>
          )}
        </div>
      )}
      {issue.status === 'ACKNOWLEDGED' && (
        <p className="emp-issue-card__acknowledged-hint">
          The admin has seen this issue and is looking into it.
        </p>
      )}
    </div>
  )
}

function EmployeeIssues({ store }: EmployeeIssuesProps) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('active')

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    getMyIssues(store.id)
      .then((data) => { if (active) setIssues(data) })
      .catch(() => { if (active) setError('Could not load your issues. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [store.id])

  const activeIssues = issues.filter((i) => i.status === 'OPEN' || i.status === 'ACKNOWLEDGED')
  const resolvedIssues = issues.filter((i) => i.status === 'RESOLVED')
  const visible = tab === 'active' ? activeIssues : tab === 'resolved' ? resolvedIssues : issues

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'active', label: 'Active', count: activeIssues.length },
    { id: 'resolved', label: 'Resolved', count: resolvedIssues.length },
    { id: 'all', label: 'All', count: issues.length },
  ]

  return (
    <div className="emp-issues-page">
      <div className="emp-issues-page__header">
        <h1 className="emp-issues-page__heading">My Issues</h1>
        <p className="emp-issues-page__subheading">
          Issues you have raised at {store.name} — and their current status.
        </p>
      </div>

      {loading && <p className="emp-issues-page__loading">Loading your issues…</p>}

      {!loading && error && (
        <div className="emp-issues-page__error">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {!loading && !error && issues.length === 0 && (
        <div className="emp-issues-page__empty">
          <MessageSquareWarning size={36} className="emp-issues-page__empty-icon" />
          <h3>No issues raised yet</h3>
          <p>Use the "Raise an Issue" button on the Home tab to flag something for the owner.</p>
        </div>
      )}

      {!loading && !error && issues.length > 0 && (
        <>
          <div className="emp-issues-tabs" role="tablist">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                className={`emp-issues-tab${tab === t.id ? ' emp-issues-tab--active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.count > 0 && <span className="emp-issues-tab__count">{t.count}</span>}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <div className="emp-issues-page__empty">
              <CheckCircle2 size={28} className="emp-issues-page__empty-icon" />
              <p>No {tab} issues.</p>
            </div>
          ) : (
            <div className="emp-issues-list">
              {visible.map((issue) => (
                <IssueCard key={issue.id} issue={issue} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default EmployeeIssues
