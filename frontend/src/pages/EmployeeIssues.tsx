import { useCallback, useMemo, useState } from 'react'
import { AlertTriangle, MessageSquareWarning, Plus } from 'lucide-react'
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
import ButtonDots from '../components/ButtonDots'
import IssueCard from '../components/IssueCard'
import { useIssueList } from '../hooks/useIssueList'
import { useIssueFocus, type IssueFocusRequest } from '../hooks/useIssueFocus'
import {
  ISSUE_NOTE_MAX_LENGTH,
  ISSUE_STATUSES,
  ISSUE_STATUS_FILTER_OPTIONS,
  ISSUE_STATUS_META,
  matchesIssueStatusFilter,
  parseIssueStatusFilter,
  type IssueStatusFilter,
} from '../utils/issueStatusMeta'
import './EmployeeIssues.css'

const CARD_ID_PREFIX = 'emp-issue-row'

interface EmployeeIssuesProps {
  store: StoreSummary
  // False while this tab is hidden (the shell keeps it mounted) -- see useIssueList.
  isActive?: boolean
  // Set from a search-result or notification click to scroll to and briefly
  // highlight that exact issue's card.
  focusIssueId?: IssueFocusRequest
}

function EmployeeIssues({ store, isActive = true, focusIssueId }: EmployeeIssuesProps) {
  const load = useCallback(() => getMyIssues(store.id), [store.id])
  const { issues, setIssues, isLoading, error, refresh } = useIssueList<Issue>(
    load, isActive, 'Could not load your issues. Please try again.',
  )

  const [statusFilter, setStatusFilter] = useState<IssueStatusFilter>(null)
  const [search, setSearch] = useState('')
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false)
  // Kept across an accidental close -- only cleared once the issue is sent.
  const [issueNote, setIssueNote] = useState('')
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false)

  const clearFilters = useCallback(() => { setStatusFilter(null); setSearch('') }, [])
  const issueIds = useMemo(() => issues.map((i) => i.id), [issues])
  const highlightedId = useIssueFocus(focusIssueId, issueIds, CARD_ID_PREFIX, clearFilters)

  const counts = useMemo(() => ({
    OPEN: issues.filter((i) => i.status === 'OPEN').length,
    ACKNOWLEDGED: issues.filter((i) => i.status === 'ACKNOWLEDGED').length,
    RESOLVED: issues.filter((i) => i.status === 'RESOLVED').length,
  }), [issues])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return issues.filter((issue) => {
      if (!matchesIssueStatusFilter(issue, statusFilter)) return false
      if (q) return issue.note.toLowerCase().includes(q) || (issue.responseText ?? '').toLowerCase().includes(q)
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
      // Make sure the new issue is visible rather than hidden by a filter.
      clearFilters()
      setIssueNote('')
      setIsRaiseModalOpen(false)
      nfToast.success('Issue raised. Owner has been notified.')
    } catch (err) {
      nfToast.error(err instanceof ApiError ? err.message : 'Could not submit issue — please try again.')
    } finally {
      setIsSubmittingIssue(false)
    }
  }

  const noteNearLimit = issueNote.length >= ISSUE_NOTE_MAX_LENGTH * 0.9

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
            onClick={() => setIsRaiseModalOpen(true)}
          >
            <Plus size={16} />
            Raise Issue
          </button>
        </div>
      </div>

      {isLoading && <p className="emp-issues-page__loading">Loading your issues…</p>}

      {!isLoading && error && (
        <div className="emp-issues-page__error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={refresh}>Retry</button>
        </div>
      )}

      {!isLoading && !error && issues.length === 0 && (
        <div className="emp-issues-page__empty">
          <MessageSquareWarning size={36} className="emp-issues-page__empty-icon" />
          <h3>No issues raised yet</h3>
          <p>Use "Raise Issue" above to flag something for the owner.</p>
        </div>
      )}

      {!isLoading && !error && issues.length > 0 && (
        <>
          <div className="stat-card-row">
            {ISSUE_STATUSES.map((status) => {
              const meta = ISSUE_STATUS_META[status]
              return (
                <StatCard
                  key={status}
                  icon={meta.icon}
                  label={meta.label}
                  value={counts[status]}
                  tone={meta.tone}
                  onClick={() => setStatusFilter((current) => (current === status ? null : status))}
                  active={statusFilter === status}
                />
              )
            })}
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
                options={ISSUE_STATUS_FILTER_OPTIONS}
                value={statusFilter ?? ''}
                onChange={(val) => setStatusFilter(parseIssueStatusFilter(val))}
                ariaLabel="Filter by status"
              />
            </div>
          </div>

          <div className="table-card">
            <div className="issue-card-list">
              {filtered.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  idPrefix={CARD_ID_PREFIX}
                  highlighted={highlightedId === issue.id}
                  showResponsePlaceholder
                />
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="table-card__empty">
                {search ? 'No issues match your search.' : 'No issues match the selected filter.'}
              </div>
            )}
          </div>

          <p className="emp-issues-page__retention-hint">
            Resolved issues are cleared from this list 7 days after they're resolved.
          </p>
        </>
      )}

      <Modal
        isOpen={isRaiseModalOpen}
        onClose={() => { if (!isSubmittingIssue) setIsRaiseModalOpen(false) }}
        centered
        title="Raise an issue"
        footer={
          <>
            <button
              type="button"
              className="btn btn--secondary"
              onClick={() => setIsRaiseModalOpen(false)}
              disabled={isSubmittingIssue}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn btn--danger${isSubmittingIssue ? ' btn--loading' : ''}`}
              disabled={isSubmittingIssue || !issueNote.trim()}
              onClick={handleSubmitIssue}
            >
              {isSubmittingIssue ? <ButtonDots label="Sending" /> : 'Send to Owner'}
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
            maxLength={ISSUE_NOTE_MAX_LENGTH}
            onChange={(e) => setIssueNote(e.target.value)}
            placeholder="Describe what needs the owner's attention..."
            autoFocus
          />
          <span className={`issue-text-counter${noteNearLimit ? ' issue-text-counter--near-limit' : ''}`} aria-live="polite">
            {issueNote.length}/{ISSUE_NOTE_MAX_LENGTH}
          </span>
        </FormField>
      </Modal>
    </div>
  )
}

export default EmployeeIssues
