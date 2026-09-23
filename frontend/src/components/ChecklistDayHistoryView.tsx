import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flag,
  HelpCircle,
  History as HistoryIcon,
  MessageSquareWarning,
  MoonStar,
  Tag,
} from 'lucide-react'
import type { HistoryTaskDetail, ShiftHistory } from '../types/history'
import type { AdminCorrectionEntry } from '../types/checklistHistory'
import { formatTimeLabel, stepDate } from '../utils/checklistHistoryOptions'
import CalendarPopover from './CalendarPopover'
import StatCard from './StatCard'
import SearchInput from './SearchInput'
import { matchesSearch } from '../utils/search'
import './ChecklistDayHistoryView.css'

interface ChecklistDayHistoryViewProps {
  heading?: string
  subheading?: string
  history: ShiftHistory | null
  loading: boolean
  error: string | null
  onRetry: () => void
  selectedDate: string
  onSelectDate: (date: string) => void
  maxDate: string
  // Optional: only rendered/applied when provided -- keeps the Employee page's
  // output byte-for-byte unchanged (it never passes these).
  searchQuery?: string
  onSearchQueryChange?: (query: string) => void
  // Extra controls (e.g. Super Admin's store picker) rendered in the same
  // sticky filter bar as the date trigger.
  extraFilters?: ReactNode
  // Fetches the full correction/resubmission trail for one response, on demand
  // when a task's "View response history" panel is expanded -- role-specific
  // (employee vs owner/admin/super admin hit different, differently-authorized
  // endpoints), so each caller passes its own. Omitted entirely -> falls back to
  // the bulk-derived resubmissionHistory only (no full-trail fetch).
  getCorrectionHistory?: (responseId: number) => Promise<AdminCorrectionEntry[]>
}

const TASK_STATUS_META = {
  YES: { label: 'Complete', badgeClass: 'badge--success', icon: CheckCircle2 },
  NO: { label: 'Flagged', badgeClass: 'badge--warning', icon: Flag },
  NOT_ANSWERED: { label: 'Not answered', badgeClass: 'badge--outline', icon: Clock },
}

function hasActivity(history: ShiftHistory | null): history is ShiftHistory {
  if (!history) return false
  return (history.hasChecklist && history.categories.length > 0) || history.issues.length > 0
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// "23 Sept 2026" style label for the date bar.
function formatNavDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Mirrors CorrectionModal's correctionValueLabel (Admin/Super Admin's own
// correction-editing modal), minus the numericUnit suffix -- HistoryTaskDetail
// carries no unit, and neither did this view's prior resubmissionHistory rendering.
function correctionValueLabel(
  entry: AdminCorrectionEntry,
  responseType: HistoryTaskDetail['responseType'],
  which: 'original' | 'corrected',
): string {
  const b = which === 'original' ? entry.originalValueBoolean : entry.correctedValueBoolean
  const n = which === 'original' ? entry.originalValueNumeric : entry.correctedValueNumeric
  const t = which === 'original' ? entry.originalValueText : entry.correctedValueText
  if (b !== null && b !== undefined) {
    return responseType === 'YES_NO' ? (b ? 'Yes' : 'No') : b ? 'Done' : 'Not done'
  }
  if (n !== null && n !== undefined) return String(n)
  if (t !== null && t !== undefined) return t
  // No value on the "corrected" side of an UNDONE entry means the employee
  // undid their answer -- a type-aware label reads better than a bare dash.
  if (which === 'corrected' && entry.correctionType === 'UNDONE') {
    if (responseType === 'YES_NO') return 'No'
    if (responseType === 'DONE_NOT_DONE') return 'Not done'
    return 'No answer'
  }
  return '—'
}

function ChecklistDayHistoryView({
  heading = 'Audit History',
  subheading = 'Review past shifts and completed tasks.',
  history,
  loading,
  error,
  onRetry,
  selectedDate,
  onSelectDate,
  maxDate,
  searchQuery,
  onSearchQueryChange,
  extraFilters,
  getCorrectionHistory,
}: ChecklistDayHistoryViewProps) {
  // Which category cards are expanded, independently of one another -- a
  // Set rather than a single id, so opening one no longer closes the rest.
  const [expandedKeys, setExpandedKeys] = useState<Set<number>>(new Set())
  // Which tasks' resubmission-history panels are open -- independent of the
  // category expand/collapse state above.
  const [expandedHistoryKeys, setExpandedHistoryKeys] = useState<Set<number>>(new Set())
  // Full correction/resubmission audit trail per response, fetched on demand the
  // first time a task's panel is expanded (keyed by responseId, not taskId, so
  // switching the selected date -- a new response row for the same task -- never
  // shows a stale cached trail from a different day) -- the bulk history payload
  // only ever carries the single latestCorrection, silently dropping any
  // correction superseded by a later one on the same response.
  const [fullHistoryByResponseId, setFullHistoryByResponseId] = useState<Map<number, AdminCorrectionEntry[]>>(new Map())
  const [fullHistoryLoadingIds, setFullHistoryLoadingIds] = useState<Set<number>>(new Set())
  const [fullHistoryErrorByResponseId, setFullHistoryErrorByResponseId] = useState<Map<number, string>>(new Map())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarButtonRef = useRef<HTMLButtonElement>(null)

  // Re-expand the first category whenever a new day's data arrives (mirrors
  // the reset that used to happen right after the fetch resolved).
  useEffect(() => {
    const firstCategoryId = hasActivity(history) ? history.categories[0]?.id : undefined
    setExpandedKeys(firstCategoryId !== undefined ? new Set([firstCategoryId]) : new Set())
  }, [history])

  let complete = 0, flagged = 0, notAnswered = 0
  if (hasActivity(history)) {
    for (const cat of history.categories) {
      for (const task of cat.tasks) {
        if (task.status === 'YES') complete++
        else if (task.status === 'NO') flagged++
        else notAnswered++
      }
    }
  }

  function toggleCategory(key: number) {
    setExpandedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleHistory(taskId: number, responseId: number | null) {
    setExpandedHistoryKeys((current) => {
      const next = new Set(current)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
    if (!getCorrectionHistory || responseId === null
      || fullHistoryByResponseId.has(responseId) || fullHistoryLoadingIds.has(responseId)) return

    setFullHistoryLoadingIds((current) => new Set(current).add(responseId))
    getCorrectionHistory(responseId)
      .then((entries) => {
        setFullHistoryByResponseId((current) => new Map(current).set(responseId, entries))
      })
      .catch((err: Error) => {
        setFullHistoryErrorByResponseId((current) => new Map(current).set(responseId, err.message))
      })
      .finally(() => {
        setFullHistoryLoadingIds((current) => {
          const next = new Set(current)
          next.delete(responseId)
          return next
        })
      })
  }

  const query = searchQuery?.trim() ?? ''
  const visibleCategories = hasActivity(history)
    ? history.categories
        .map((category) => {
          if (!query) return category
          const categoryMatches = matchesSearch(query, [category.name])
          if (categoryMatches) return category
          const tasks = category.tasks.filter((task) => matchesSearch(query, [task.name]))
          return tasks.length > 0 ? { ...category, tasks } : null
        })
        .filter((category): category is NonNullable<typeof category> => category !== null)
    : []
  const hasFiltersBar = extraFilters !== undefined || onSearchQueryChange !== undefined
  const yesterdayDate = stepDate(maxDate, -1)
  const canGoForward = selectedDate < maxDate

  return (
    <div className="employee-history">
      <div className="employee-history-header">
        <h1 className="employee-history-heading">{heading}</h1>
        <p className="employee-history-subheading">{subheading}</p>
      </div>

      <div className="stat-card-row" style={{ marginBottom: 'var(--space-lg)' }}>
        <StatCard icon={CheckCircle2} label="Tasks Complete" value={complete} tone="success" />
        <StatCard icon={Flag} label="Flagged" value={flagged} tone="warning" />
        <StatCard icon={HelpCircle} label="Not Answered" value={notAnswered} tone="primary" />
      </div>

      <div className={`employee-history-filters${hasFiltersBar ? ' employee-history-filters--extended' : ''}`}>
        {extraFilters}
        <div className="employee-history-date-trigger-wrap">
          <button
            type="button"
            className="employee-history-date-step"
            onClick={() => onSelectDate(stepDate(selectedDate, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            ref={calendarButtonRef}
            type="button"
            className="employee-history-date-trigger"
            onClick={() => setIsCalendarOpen((open) => !open)}
            aria-label="Pick a date"
            aria-haspopup="dialog"
            aria-expanded={isCalendarOpen}
          >
            <Calendar size={14} aria-hidden="true" />
            <span>{formatNavDateLabel(selectedDate)}</span>
          </button>
          <button
            type="button"
            className="employee-history-date-step"
            onClick={() => onSelectDate(stepDate(selectedDate, 1))}
            disabled={!canGoForward}
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
          <CalendarPopover
            value={selectedDate}
            max={maxDate}
            isOpen={isCalendarOpen}
            onClose={() => setIsCalendarOpen(false)}
            onSelect={onSelectDate}
            anchorRef={calendarButtonRef}
          />
        </div>
        <div className="employee-history-quick-dates" role="group" aria-label="Quick date">
          <button
            type="button"
            className={`employee-history-quick-date${selectedDate === maxDate ? ' employee-history-quick-date--active' : ''}`}
            aria-pressed={selectedDate === maxDate}
            onClick={() => onSelectDate(maxDate)}
          >
            Today
          </button>
          <button
            type="button"
            className={`employee-history-quick-date${selectedDate === yesterdayDate ? ' employee-history-quick-date--active' : ''}`}
            aria-pressed={selectedDate === yesterdayDate}
            onClick={() => onSelectDate(yesterdayDate)}
          >
            Yesterday
          </button>
        </div>
        {onSearchQueryChange && (
          <div className="employee-history-extra-filter">
            <SearchInput
              value={searchQuery ?? ''}
              onChange={onSearchQueryChange}
              placeholder="Search tasks or categories..."
              variant="filter"
            />
          </div>
        )}
      </div>

      {loading && (
        <div className="employee-history-skeleton" aria-hidden="true">
          {[0, 1, 2].map((index) => (
            <div key={index} className="employee-history-skeleton-card" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="employee-history-error">
          <AlertTriangle size={18} />
          <span>{error}</span>
          <button type="button" className="btn btn--secondary" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {!loading && !error && !hasActivity(history) && (
        <div className="employee-history-empty">
          <MoonStar size={28} />
          <h3>No activity recorded</h3>
          <p>No activity recorded for this date. Tasks only appear here after at least one response has been submitted.</p>
        </div>
      )}

      {!loading && !error && hasActivity(history) && (
        <div className="employee-history-list">
          <div className="employee-history-store-group">
            {history.issues.length > 0 && (
              <div className="employee-history-issues">
                <h3 className="employee-history-issues-heading">Raised Issues</h3>
                {history.issues.map((issue) => (
                  <div key={issue.id} className="employee-history-issue-card">
                    <div className="employee-history-issue-card-top">
                      <span className="employee-history-issue-card-icon" aria-hidden="true">
                        <MessageSquareWarning size={16} />
                      </span>
                      <p className="employee-history-issue-note">{issue.note}</p>
                      <span className={`badge ${issue.status === 'RESOLVED' ? 'badge--success' : issue.status === 'ACKNOWLEDGED' ? 'badge--info' : 'badge--warning'}`}>
                        {issue.status === 'RESOLVED' ? 'Resolved' : issue.status === 'ACKNOWLEDGED' ? 'Acknowledged' : 'Open'}
                      </span>
                    </div>
                    <p className="employee-history-issue-meta">Raised at {issue.raisedAt}</p>
                    {(issue.status === 'RESOLVED' || issue.status === 'ACKNOWLEDGED') && issue.responseText && (
                      <div className="employee-history-issue-response">
                        <p className="employee-history-issue-response-text">{issue.responseText}</p>
                        <p className="employee-history-issue-meta">
                          {issue.respondedByName ? `${issue.respondedByName} · ` : ''}
                          {issue.respondedAt}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {visibleCategories.map((category) => {
              const isComplete = category.tasksTotal > 0 && category.tasksCompleted === category.tasksTotal
              const isExpanded = expandedKeys.has(category.id)

              return (
                <div
                  key={category.id}
                  className={`employee-history-card${isComplete ? ' employee-history-card--complete' : ''}${isExpanded ? ' employee-history-card--expanded' : ''}`}
                >
                  <button
                    type="button"
                    className="employee-history-card-header"
                    onClick={() => toggleCategory(category.id)}
                    aria-expanded={isExpanded}
                  >
                    <span className={`employee-history-card-icon employee-history-card-icon--${category.badgeColor}`}>
                      <Tag size={17} />
                      {isComplete && (
                        <span className="employee-history-card-icon-check" aria-hidden="true">
                          <CheckCircle2 size={12} />
                        </span>
                      )}
                    </span>
                    <span className="employee-history-card-heading">
                      <span className="employee-history-card-name">{category.name}</span>
                    </span>
                    <span className="employee-history-card-meta">
                      <span className="employee-history-card-count">
                        {category.tasksCompleted}/{category.tasksTotal}
                      </span>
                      <ChevronDown size={18} className="employee-history-card-chevron" />
                    </span>
                  </button>

                  <div className="employee-history-card-body">
                    <div className="employee-history-card-body-inner">
                      {category.tasks.map((task) => {
                        const meta = TASK_STATUS_META[task.status]
                        const StatusIcon = meta.icon
                        const isHistoryExpanded = expandedHistoryKeys.has(task.id)
                        return (
                          <div key={task.id} className="employee-history-task">
                            <div className="employee-history-task-info">
                              <p className="employee-history-task-name">{task.name}</p>
                              {task.responseValue ? (
                                <p className="employee-history-task-value">
                                  {task.responseValue}
                                  {task.completedBy && (
                                    <span className="employee-history-task-value-meta">
                                      {' · '}
                                      {task.completedBy.name}
                                      {task.completedAt ? ` · ${task.completedAt}` : ''}
                                    </span>
                                  )}
                                </p>
                              ) : (
                                <p className="employee-history-task-detail">
                                  {task.completedBy
                                    ? `${task.completedBy.name}${task.completedAt ? ` · ${task.completedAt}` : ''}`
                                    : 'No staff recorded'}
                                </p>
                              )}
                              {task.resubmissionHistory.length > 0 && (
                                <>
                                  <button
                                    type="button"
                                    className="employee-history-task-history-toggle"
                                    onClick={() => toggleHistory(task.id, task.responseId)}
                                    aria-expanded={isHistoryExpanded}
                                  >
                                    <HistoryIcon size={12} />
                                    {isHistoryExpanded ? 'Hide' : 'View'} response history
                                  </button>
                                  {isHistoryExpanded && (() => {
                                    const fullHistory = task.responseId !== null
                                      ? fullHistoryByResponseId.get(task.responseId)
                                      : undefined
                                    const fullHistoryError = task.responseId !== null
                                      ? fullHistoryErrorByResponseId.get(task.responseId)
                                      : undefined
                                    const isLoadingFullHistory = task.responseId !== null
                                      && fullHistoryLoadingIds.has(task.responseId)

                                    // Full server trail once fetched (every DIRECT correction/
                                    // flag/resubmission, not just the latest); the bulk-derived
                                    // resubmissionHistory is only a fallback while it loads (or
                                    // when no getCorrectionHistory fetcher was supplied at all).
                                    if (fullHistory) {
                                      return (
                                        <div className="employee-history-task-history-list">
                                          {fullHistory.length === 0 && (
                                            <p className="employee-history-task-history-meta">No changes recorded.</p>
                                          )}
                                          {fullHistory.map((entry, index) => (
                                            <div key={entry.id ?? `resubmission-${index}`} className="employee-history-task-history-item">
                                              <p className="employee-history-task-history-change">
                                                {correctionValueLabel(entry, task.responseType, 'original')}
                                                {' → '}
                                                {correctionValueLabel(entry, task.responseType, 'corrected')}
                                              </p>
                                              <p className="employee-history-task-history-meta">
                                                {entry.correctionType === 'RESUBMISSION'
                                                  ? 'Resubmitted by'
                                                  : entry.correctionType === 'UNDONE'
                                                    ? 'Undone by'
                                                    : 'Corrected by'}{' '}
                                                {entry.correctedByFullName}
                                                {' · '}{formatDateLabel(entry.correctedAt.slice(0, 10))} {formatTimeLabel(entry.correctedAt)}
                                              </p>
                                              {entry.reason && (
                                                <p className="employee-history-task-history-reason">
                                                  &ldquo;{entry.reason}&rdquo;
                                                </p>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )
                                    }

                                    if (fullHistoryError) {
                                      return (
                                        <p className="employee-history-task-history-meta">
                                          Couldn&apos;t load full history: {fullHistoryError}
                                        </p>
                                      )
                                    }

                                    return (
                                      <div className="employee-history-task-history-list">
                                        {isLoadingFullHistory && (
                                          <p className="employee-history-task-history-meta">Loading…</p>
                                        )}
                                        {task.resubmissionHistory.map((transition, index) => (
                                          <div key={index} className="employee-history-task-history-item">
                                            <p className="employee-history-task-history-change">
                                              {transition.fromValue ?? '—'} → {transition.toValue ?? '—'}
                                            </p>
                                            <p className="employee-history-task-history-meta">
                                              {transition.kind === 'DIRECT_CORRECTION'
                                                ? 'Corrected by'
                                                : transition.kind === 'UNDONE'
                                                  ? 'Undone by'
                                                  : 'Flagged by'}{' '}
                                              {transition.flaggedByName ?? 'Owner'}
                                              {transition.flaggedAt ? ` · ${transition.flaggedAt}` : ''}
                                            </p>
                                            {transition.flagReason && (
                                              <p className="employee-history-task-history-reason">
                                                &ldquo;{transition.flagReason}&rdquo;
                                              </p>
                                            )}
                                            {transition.kind === 'FLAG_RESUBMIT' && (
                                              <p className="employee-history-task-history-meta">
                                                Resubmitted by {transition.resubmittedByName} · {transition.resubmittedAt}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    )
                                  })()}
                                </>
                              )}
                            </div>
                            <span className={`badge ${meta.badgeClass} employee-history-task-status`}>
                              <StatusIcon size={14} />
                              {meta.label}
                            </span>
                            {task.completedVia === 'MOVED' && (
                              <span className="badge badge--info" title="Completed as a moved task, attributed to its original due date">
                                Moved completion
                              </span>
                            )}
                            {task.completedVia === 'LINK_FULFILLED' && (
                              <span className="badge badge--info" title="Auto-completed when today's checklist was completed">
                                completed via today's checklist
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

export default ChecklistDayHistoryView
