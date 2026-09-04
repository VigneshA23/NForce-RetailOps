import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Flag,
  HelpCircle,
  Lock,
  MessageSquareWarning,
  MoonStar,
  Sparkles,
  Store as StoreIcon,
  Sunrise,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getShiftHistory } from '../api/history'
import type { StoreSummary } from '../types/store'
import type { ShiftHistory, TaskStatus } from '../types/history'
import SearchableSelect from '../components/SearchableSelect'
import CalendarPopover from '../components/CalendarPopover'
import './EmployeeHistory.css'

interface EmployeeHistoryProps {
  store: StoreSummary
  // The same server-scoped list the shell was given, so history can only ever
  // be viewed for a store the employee is assigned to.
  stores: StoreSummary[]
}

// Keyed by category name (lowercased) rather than id -- unlike the old mock,
// real categories are owner-defined with arbitrary numeric ids, so only the
// name is a stable enough hook for a themed icon/tone. Falls back to Clock
// and a neutral tone below for anything an owner names outside these three.
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  preparation: Sunrise,
  cleaning: Sparkles,
  closing: Lock,
}

const CATEGORY_TONES: Record<string, string> = {
  preparation: 'warning',
  cleaning: 'success',
  closing: 'purple',
}

const TASK_STATUS_META: Record<TaskStatus, { label: string; badgeClass: string; icon: LucideIcon }> = {
  YES: { label: 'Complete', badgeClass: 'badge--success', icon: CheckCircle2 },
  NO: { label: 'Flagged', badgeClass: 'badge--warning', icon: Flag },
  NOT_ANSWERED: { label: 'Not answered', badgeClass: 'badge--outline', icon: HelpCircle },
}

const ALL_STORES_VALUE = 'all'
type StoreFilter = number | typeof ALL_STORES_VALUE

interface StoreHistoryEntry {
  store: StoreSummary
  history: ShiftHistory | null
}

function entryHasActivity(entry: StoreHistoryEntry): entry is StoreHistoryEntry & { history: ShiftHistory } {
  if (!entry.history) return false
  return (entry.history.hasChecklist && entry.history.categories.length > 0) || entry.history.issues.length > 0
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

// Categories are owner-wide, so the same category id can legitimately appear
// under more than one store -- expand/collapse state (and list keys) for the
// "All" view are namespaced per store to keep them independent.
function categoryKey(storeId: number, categoryId: number): string {
  return `${storeId}:${categoryId}`
}

function EmployeeHistory({ store, stores }: EmployeeHistoryProps) {
  const availableStores = stores.length > 0 ? stores : [store]
  const [selectedStoreId, setSelectedStoreId] = useState<StoreFilter>(store.id)
  // Defaults to yesterday: a shift's checklist is realistically only fully
  // wrapped up (and worth reviewing) once the day is over, so that's the more
  // useful starting point than an in-progress "today".
  const [selectedDate, setSelectedDate] = useState(yesterdayDate)
  const [historyEntries, setHistoryEntries] = useState<StoreHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Which category cards are expanded, independently of one another -- a
  // Set rather than a single id, so opening one no longer closes the rest.
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const calendarButtonRef = useRef<HTMLButtonElement>(null)

  function loadHistory() {
    let active = true
    setLoading(true)
    setError(null)

    const targetStores =
      selectedStoreId === ALL_STORES_VALUE
        ? availableStores
        : availableStores.filter((candidate) => candidate.id === selectedStoreId)

    Promise.all(
      targetStores.map((target) =>
        getShiftHistory(target.id, selectedDate).then((history): StoreHistoryEntry => ({ store: target, history })),
      ),
    )
      .then((results) => {
        if (!active) return
        setHistoryEntries(results)

        const firstWithActivity = results.find(entryHasActivity)
        const firstCategoryId = firstWithActivity?.history.categories[0]?.id
        setExpandedKeys(
          firstWithActivity && firstCategoryId !== undefined
            ? new Set([categoryKey(firstWithActivity.store.id, firstCategoryId)])
            : new Set(),
        )
      })
      .catch((err: Error) => {
        if (!active) return
        setHistoryEntries([])
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
  }, [selectedStoreId, selectedDate])

  const entriesWithActivity = useMemo(() => historyEntries.filter(entryHasActivity), [historyEntries])
  const hasActivity = entriesWithActivity.length > 0
  // The per-store heading is only useful once more than one store's worth of
  // history is actually being shown at once -- a single-store selection (the
  // default) never renders it, keeping that view exactly as before.
  const showStoreHeadings = entriesWithActivity.length > 1
  const emptyStateScope =
    selectedStoreId === ALL_STORES_VALUE
      ? 'any of your stores'
      : (availableStores.find((candidate) => candidate.id === selectedStoreId)?.name ?? store.name)

  function toggleCategory(key: string) {
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

  return (
    <div className="employee-history">
      <div className="employee-history-header">
        <h1 className="employee-history-heading">Audit History</h1>
        <p className="employee-history-subheading">Review past shifts and completed tasks.</p>
      </div>

      <div className="employee-history-filters">
        <div className="employee-history-store-select">
          <span className="employee-history-store-select-icon">
            <StoreIcon size={16} />
          </span>
          <SearchableSelect
            id="employee-history-store"
            options={availableStores.map((option) => ({ id: option.id, label: option.name }))}
            selectedIds={selectedStoreId === ALL_STORES_VALUE ? [] : [selectedStoreId]}
            onChange={(ids) => setSelectedStoreId(ids[0] ?? ALL_STORES_VALUE)}
            placeholder="Select a store"
            allOption={{
              label: 'All Stores',
              selected: selectedStoreId === ALL_STORES_VALUE,
              onToggle: () => setSelectedStoreId(ALL_STORES_VALUE),
            }}
          />
        </div>

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

      {!loading && !error && !hasActivity && (
        <div className="employee-history-empty">
          <MoonStar size={28} />
          <h3>Nothing logged yet</h3>
          <p>
            No checklist activity recorded for {emptyStateScope} on {formatDateLabel(selectedDate)}.
          </p>
        </div>
      )}

      {!loading && !error && hasActivity && (
        <div className="employee-history-list">
          {entriesWithActivity.map(({ store: entryStore, history }) => (
            <div key={entryStore.id} className="employee-history-store-group">
              {showStoreHeadings && <h2 className="employee-history-store-group-heading">{entryStore.name}</h2>}
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
                        <span className={`badge ${issue.status === 'RESOLVED' ? 'badge--success' : 'badge--warning'}`}>
                          {issue.status === 'RESOLVED' ? 'Resolved' : 'Open'}
                        </span>
                      </div>
                      <p className="employee-history-issue-meta">Raised at {issue.raisedAt}</p>
                      {issue.status === 'RESOLVED' && issue.responseText && (
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
                const Icon = CATEGORY_ICONS[category.name.toLowerCase()] ?? Clock
                const tone = CATEGORY_TONES[category.name.toLowerCase()] ?? 'outline'
                const isComplete = category.tasksTotal > 0 && category.tasksCompleted === category.tasksTotal
                const key = categoryKey(entryStore.id, category.id)
                const isExpanded = expandedKeys.has(key)

                return (
                  <div
                    key={key}
                    className={`employee-history-card${isComplete ? ' employee-history-card--complete' : ''}${isExpanded ? ' employee-history-card--expanded' : ''}`}
                  >
                    <button
                      type="button"
                      className="employee-history-card-header"
                      onClick={() => toggleCategory(key)}
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
          ))}
        </div>
      )}
    </div>
  )
}

export default EmployeeHistory
