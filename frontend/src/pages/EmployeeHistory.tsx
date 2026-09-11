import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Flag,
  HelpCircle,
  History as HistoryIcon,
  MessageSquareWarning,
  MoonStar,
} from 'lucide-react'
import { getShiftHistory } from '../api/history'
import type { StoreSummary } from '../types/store'
import type { ShiftHistory } from '../types/history'
import CalendarPopover from '../components/CalendarPopover'
import StatCard from '../components/StatCard'
import './EmployeeHistory.css'

interface EmployeeHistoryProps {
  store: StoreSummary
}

const TASK_STATUS_META = {
  YES: { label: 'Complete', badgeClass: 'badge--success', icon: CheckCircle2 },
  NO: { label: 'Flagged', badgeClass: 'badge--warning', icon: Flag },
  NOT_ANSWERED: { label: 'Not answered', badgeClass: 'badge--outline', icon: HelpCircle },
}

function hasActivity(history: ShiftHistory | null): history is ShiftHistory {
  if (!history) return false
  return (history.hasChecklist && history.categories.length > 0) || history.issues.length > 0
}

// YYYY-MM-DD from the Date object's own LOCAL calendar fields -- deliberately
// not toISOString().slice(0, 10), which converts to UTC first and silently
// shifts the date by a day for part of the day in any timezone ahead of UTC
// (e.g. early morning IST is still "yesterday" in UTC).
function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function todayDate(): string {
  return toDateKey(new Date())
}

function yesterdayDate(): string {
  const date = new Date()
  date.setDate(date.getDate() - 1)
  return toDateKey(date)
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function EmployeeHistory({ store }: EmployeeHistoryProps) {
  // Defaults to yesterday: a shift's checklist is realistically only fully
  // wrapped up (and worth reviewing) once the day is over, so that's the more
  // useful starting point than an in-progress "today".
  const [selectedDate, setSelectedDate] = useState(yesterdayDate)
  const [history, setHistory] = useState<ShiftHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Which category cards are expanded, independently of one another -- a
  // Set rather than a single id, so opening one no longer closes the rest.
  const [expandedKeys, setExpandedKeys] = useState<Set<number>>(new Set())
  // Which tasks' resubmission-history panels are open -- independent of the
  // category expand/collapse state above.
  const [expandedHistoryKeys, setExpandedHistoryKeys] = useState<Set<number>>(new Set())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarButtonRef = useRef<HTMLButtonElement>(null)

  function loadHistory() {
    let active = true
    setLoading(true)
    setError(null)

    getShiftHistory(store.id, selectedDate)
      .then((result) => {
        if (!active) return
        setHistory(result)

        const firstCategoryId = hasActivity(result) ? result.categories[0]?.id : undefined
        setExpandedKeys(firstCategoryId !== undefined ? new Set([firstCategoryId]) : new Set())
      })
      .catch((err: Error) => {
        if (!active) return
        setHistory(null)
        setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }

  useEffect(() => {
    const cancel = loadHistory()
    return cancel
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.id, selectedDate])

  const historyStats = useMemo(() => {
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
    return { complete, flagged, notAnswered }
  }, [history])

  function toggleCategory(key: number) {
    setExpandedKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function toggleHistory(key: number) {
    setExpandedHistoryKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  return (
    <div className="employee-history">
      <div className="employee-history-header">
        <h1 className="employee-history-heading">Audit History</h1>
        <p className="employee-history-subheading">Review past shifts and completed tasks.</p>
      </div>

      <div className="stat-card-row" style={{ marginBottom: 'var(--space-lg)' }}>
        <StatCard icon={CheckCircle2} label="Tasks Complete" value={historyStats.complete} tone="success" />
        <StatCard icon={Flag} label="Flagged" value={historyStats.flagged} tone="warning" />
        <StatCard icon={HelpCircle} label="Not Answered" value={historyStats.notAnswered} tone="primary" />
      </div>

      <div className="employee-history-filters">
        <div className="employee-history-date-trigger-wrap">
          <button
            ref={calendarButtonRef}
            type="button"
            className="employee-history-date-trigger"
            onClick={() => setIsCalendarOpen((open) => !open)}
            aria-label="Pick a date"
            aria-haspopup="dialog"
            aria-expanded={isCalendarOpen}
          >
            <span className="icon-mask-calendar" style={{ width: 16, height: 16 }} aria-hidden="true" />
            <span>{formatDateLabel(selectedDate)}</span>
          </button>
          <CalendarPopover
            value={selectedDate}
            max={todayDate()}
            isOpen={isCalendarOpen}
            onClose={() => setIsCalendarOpen(false)}
            onSelect={setSelectedDate}
            anchorRef={calendarButtonRef}
          />
        </div>
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
          <button type="button" className="btn btn--secondary" onClick={loadHistory}>
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
            {history.categories.map((category) => {
              const Icon = ClipboardList
              const tone = 'info'
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
                    <span className={`employee-history-card-icon employee-history-card-icon--${tone}`}>
                      <Icon size={18} />
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
                              {task.completedByAll.length > 1 ? (
                                task.completedByAll.map((responder) => (
                                  <p
                                    key={responder.employeeUserId}
                                    className="employee-history-task-detail"
                                  >
                                    {`${responder.name} · ${responder.respondedAt}`}
                                  </p>
                                ))
                              ) : (
                                <p className="employee-history-task-detail">
                                  {task.completedBy
                                    ? `${task.completedBy.name}${task.completedAt ? ` · ${task.completedAt}` : ''}`
                                    : 'No staff recorded'}
                                </p>
                              )}
                              {task.responseValue && (
                                <p className="employee-history-task-value">{task.responseValue}</p>
                              )}
                              {task.resubmissionHistory.length > 0 && (
                                <>
                                  <button
                                    type="button"
                                    className="employee-history-task-history-toggle"
                                    onClick={() => toggleHistory(task.id)}
                                    aria-expanded={isHistoryExpanded}
                                  >
                                    <HistoryIcon size={12} />
                                    {isHistoryExpanded ? 'Hide' : 'View'} response history ({task.resubmissionHistory.length})
                                  </button>
                                  {isHistoryExpanded && (
                                    <div className="employee-history-task-history-list">
                                      {task.resubmissionHistory.map((transition, index) => (
                                        <div key={index} className="employee-history-task-history-item">
                                          <p className="employee-history-task-history-change">
                                            {transition.fromValue ?? '—'} → {transition.toValue ?? '—'}
                                          </p>
                                          <p className="employee-history-task-history-meta">
                                            {transition.kind === 'DIRECT_CORRECTION' ? 'Corrected by' : 'Flagged by'}{' '}
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
                                  )}
                                </>
                              )}
                            </div>
                            <span className={`badge ${meta.badgeClass} employee-history-task-status`}>
                              <StatusIcon size={14} />
                              {meta.label}
                            </span>
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

export default EmployeeHistory
