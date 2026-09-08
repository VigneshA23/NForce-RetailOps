import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, MessageSquareWarning, Plus } from 'lucide-react'
import { getMyIssues, raiseIssue } from '../api/issues'
import { ApiError } from '../api/client'
import { nfToast } from '../utils/toast'
import type { Issue } from '../types/issue'
import type { StoreSummary } from '../types/store'
import StatCard from '../components/StatCard'
import SearchInput from '../components/SearchInput'
import Select from '../components/Select'
import Modal from '../components/Modal'
import FormField from '../components/FormField'
import './EmployeeIssues.css'

type StatusFilter = 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | null

const STATUS_BADGE: Record<Issue['status'], string> = {
  OPEN: 'badge--warning',
  ACKNOWLEDGED: 'badge--info',
  RESOLVED: 'badge--success',
}

const STATUS_LABEL: Record<Issue['status'], string> = {
  OPEN: 'Open',
  ACKNOWLEDGED: 'Acknowledged',
  RESOLVED: 'Resolved',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

interface EmployeeIssuesProps {
  store: StoreSummary
}

function EmployeeIssues({ store }: EmployeeIssuesProps) {
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null)
  const [search, setSearch] = useState('')
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false)
  const [issueNote, setIssueNote] = useState('')
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false)

  function loadIssues() {
    let active = true
    setLoading(true)
    setError(null)
    getMyIssues(store.id)
      .then((data) => { if (active) setIssues(data) })
      .catch(() => { if (active) setError('Could not load your issues. Please try again.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }

  useEffect(() => loadIssues(), [store.id])

  const openCount = useMemo(() => issues.filter((i) => i.status === 'OPEN').length, [issues])
  const acknowledgedCount = useMemo(() => issues.filter((i) => i.status === 'ACKNOWLEDGED').length, [issues])
  const resolvedCount = useMemo(() => issues.filter((i) => i.status === 'RESOLVED').length, [issues])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return issues.filter((issue) => {
      if (statusFilter !== null && issue.status !== statusFilter) return false
      if (q) return issue.note.toLowerCase().includes(q)
      return true
    })
  }, [issues, statusFilter, search])

  async function handleSubmitIssue() {
    const note = issueNote.trim()
    if (!note) return
    setIsSubmittingIssue(true)
    try {
      const newIssue = await raiseIssue(store.id, note)
      setIssues((prev) => [newIssue, ...prev])
      setIssueNote('')
      setIsRaiseModalOpen(false)
      nfToast.success('Issue raised. Owner has been notified.')
    } catch (err) {
      nfToast.error(err instanceof ApiError ? err.message : 'Could not submit issue — please try again.')
    } finally {
      setIsSubmittingIssue(false)
    }
  }

  return (
    <div className="emp-issues-page">
      <div className="emp-issues-page__header">
        <div className="emp-issues-page__title-row">
          <div>
            <h1 className="emp-issues-page__heading">Issues</h1>
            <p className="emp-issues-page__subheading">
              Issues you have raised at {store.name} and their current status.
            </p>
          </div>
          <button
            type="button"
            className="btn btn--danger"
            onClick={() => { setIssueNote(''); setIsRaiseModalOpen(true) }}
          >
            <Plus size={16} />
            Raise Issue
          </button>
        </div>
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
          <p>Use "Raise Issue" above to flag something for the owner.</p>
        </div>
      )}

      {!loading && !error && issues.length > 0 && (
        <>
          <p className="emp-issues-page__total">
            {issues.length} issue{issues.length !== 1 ? 's' : ''} total
          </p>

          <div className="stat-card-row">
            <StatCard icon={AlertTriangle} label="Open" value={openCount} tone="primary" />
            <StatCard icon={Clock} label="Acknowledged" value={acknowledgedCount} tone="warning" />
            <StatCard icon={CheckCircle2} label="Resolved" value={resolvedCount} tone="success" />
          </div>

          <div className="filter-bar">
            <div className="filter filter--search">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search issues…"
                variant="filter"
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
                    <th scope="col">Date</th>
                    <th scope="col">Issue</th>
                    <th scope="col">Status</th>
                    <th scope="col">Admin Response</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((issue) => (
                    <tr key={issue.id}>
                      <td data-label="Date" className="emp-issues-page__date-cell">
                        {formatDate(issue.raisedDate)}
                      </td>
                      <td data-label="Issue">
                        <span className="emp-issues-page__note">
                          {issue.note}
                        </span>
                      </td>
                      <td data-label="Status">
                        <span className={`badge ${STATUS_BADGE[issue.status]}`}>
                          {STATUS_LABEL[issue.status]}
                        </span>
                      </td>
                      <td data-label="Admin Response">
                        {issue.responseText ? (
                          <span className="emp-issues-page__response">
                            {issue.responseText}
                            {issue.respondedByFullName && (
                              <span className="emp-issues-page__response-by"> — {issue.respondedByFullName}</span>
                            )}
                          </span>
                        ) : issue.status === 'ACKNOWLEDGED' ? (
                          <span className="emp-issues-page__response emp-issues-page__response--hint">
                            Being looked into
                          </span>
                        ) : (
                          <span className="emp-issues-page__response emp-issues-page__response--none">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="table-card__empty">
                {search ? 'No issues match your search.' : 'No issues match the selected filter.'}
              </div>
            )}
          </div>
        </>
      )}

      <Modal
        isOpen={isRaiseModalOpen}
        onClose={() => setIsRaiseModalOpen(false)}
        centered
        title="Raise an issue"
        footer={
          <>
            <button type="button" className="btn btn--secondary" onClick={() => setIsRaiseModalOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--danger"
              disabled={isSubmittingIssue || !issueNote.trim()}
              onClick={handleSubmitIssue}
            >
              {isSubmittingIssue ? 'Sending...' : 'Send to Owner'}
            </button>
          </>
        }
      >
        <FormField label="What's the issue?" htmlFor="emp-issue-note">
          <textarea
            id="emp-issue-note"
            className="input"
            rows={4}
            value={issueNote}
            onChange={(e) => setIssueNote(e.target.value)}
            placeholder="Describe what needs the owner's attention..."
            autoFocus
          />
        </FormField>
      </Modal>
    </div>
  )
}

export default EmployeeIssues
