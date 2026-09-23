import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarPlus, CheckCircle2, ChevronLeft, Clock } from 'lucide-react'
import { ApiError } from '../api/client'
import { getMissedTasks, moveMissedTask } from '../api/missedTasks'
import type { StoreSummary } from '../types/store'
import type { MissedTaskDateGroup, MissedTaskInstance } from '../types/missedTasks'
import { responseTypeLabel, scheduleSummary } from '../utils/adminTaskOptions'
import ButtonDots from '../components/ButtonDots'
import CalendarPopover from '../components/CalendarPopover'
import Select from '../components/Select'
import SearchInput from '../components/SearchInput'
import './MissingTasks.css'

interface MissingTasksProps {
  store: StoreSummary
  // Lets the caller (EmployeeShell) refresh its "Missed Tasks" badge/tile and
  // dashboard banner right away after a move, instead of waiting out the poll
  // interval.
  onMoved?: () => void
  // Returns the employee to the page they navigated from (the daily
  // checklist) -- this page has no side-nav entry, so it's only ever reached
  // via the checklist's banner or the Home stat tile.
  onBack?: () => void
}

const GENERIC_ERROR = "Couldn't move this task. Please try again."
// Interim cap: a move's target date may be at most this many days out.
const MAX_MOVE_DAYS_AHEAD = 7
const ALL = 'all'

function instanceKey(instance: MissedTaskInstance): string {
  return `${instance.taskId}:${instance.date}`
}

// Parsed as a local calendar date, not UTC midnight, so "yesterday" always
// reads as yesterday regardless of the viewer's timezone offset.
function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function localDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(base: Date, days: number): Date {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function formatDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

// Only yesterday reads as "Yesterday" -- older dates just show their plain
// date, same as the reference layout.
function relativeDayLabel(date: string): string | null {
  const yesterday = new Date()
  yesterday.setHours(0, 0, 0, 0)
  yesterday.setDate(yesterday.getDate() - 1)
  return parseLocalDate(date).getTime() === yesterday.getTime() ? 'Yesterday' : null
}

const RESPONSE_TYPE_ORDER: Record<MissedTaskInstance['responseType'], number> = {
  YES_NO: 0,
  DONE_NOT_DONE: 1,
  NUMERIC: 2,
  TEXT: 3,
}

// Newest date first; within a date, actionable rows before rows already
// blocked on a second person (nothing to do there right now), with response
// type as the final tiebreaker so the same kind of task reads consecutively.
function compareInstances(a: MissedTaskInstance, b: MissedTaskInstance): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1
  const priority = (instance: MissedTaskInstance): number => (instance.state === 'ACTIONABLE' ? 0 : 1)
  const priorityDiff = priority(a) - priority(b)
  if (priorityDiff !== 0) return priorityDiff
  return RESPONSE_TYPE_ORDER[a.responseType] - RESPONSE_TYPE_ORDER[b.responseType]
}

/**
 * Dedicated "Missed Tasks" page: past-day instances of this store's tasks
 * that were never completed, listed as a table (Daily Checklist's own
 * Outstanding Tasks look) filterable by date and category. The only action
 * here is Move -- completion always happens through the normal checklist,
 * once the instance has been moved onto a target date.
 */
function MissingTasks({ store, onMoved, onBack }: MissingTasksProps) {
  const [groups, setGroups] = useState<MissedTaskDateGroup[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [openCalendarKey, setOpenCalendarKey] = useState<string | null>(null)
  const [taskSearch, setTaskSearch] = useState('')
  const [dateFilter, setDateFilter] = useState<string>(ALL)
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL)
  const anchorRef = useRef<HTMLButtonElement | null>(null)
  // Cancels a still-in-flight load before starting another -- without this,
  // React's dev-mode double-invoked mount effect fires two real requests to
  // this (slow) endpoint for what is logically a single page load.
  const controllerRef = useRef<AbortController | null>(null)

  const todayKey = localDateKey(new Date())
  const maxTargetKey = localDateKey(addDays(new Date(), MAX_MOVE_DAYS_AHEAD))

  function loadFirstPage() {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError(null)
    getMissedTasks(store.id, undefined, controller.signal)
      .then((page) => {
        setGroups(page.groups)
        setNextCursor(page.nextCursor)
        setLoading(false)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        const message =
          err instanceof ApiError && err.status === 404
            ? "You're not assigned to this store, so no missed tasks are available."
            : "Couldn't load missed tasks. Please try again."
        setError(message)
        setGroups([])
        setLoading(false)
      })
  }

  useEffect(() => {
    loadFirstPage()
    return () => controllerRef.current?.abort()
  }, [store.id])

  async function loadMore() {
    if (!nextCursor || loadingMore) return
    setLoadingMore(true)
    try {
      const page = await getMissedTasks(store.id, nextCursor)
      setGroups((previous) => [...previous, ...page.groups])
      setNextCursor(page.nextCursor)
    } catch {
      setError('Could not load older missed tasks. Please try again.')
    } finally {
      setLoadingMore(false)
    }
  }

  function replaceInstance(key: string, updater: (instance: MissedTaskInstance) => MissedTaskInstance | null) {
    setGroups((previous) =>
      previous
        .map((group) => ({
          ...group,
          instances: group.instances
            .map((instance) => (instanceKey(instance) === key ? updater(instance) : instance))
            .filter((instance): instance is MissedTaskInstance => instance !== null),
        }))
        .filter((group) => group.instances.length > 0),
    )
  }

  async function move(instance: MissedTaskInstance, targetDate: string) {
    const key = instanceKey(instance)
    if (pendingKey) return
    setPendingKey(key)
    setRowErrors((previous) => ({ ...previous, [key]: '' }))
    try {
      await moveMissedTask(instance.taskId, instance.date, store.id, targetDate)
      // Creating a move makes the instance disappear from the missed list
      // immediately -- it now lives on targetDate's checklist instead.
      replaceInstance(key, () => null)
      onMoved?.()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : GENERIC_ERROR
      setRowErrors((previous) => ({ ...previous, [key]: message }))
      if (err instanceof ApiError && err.status === 409) loadFirstPage()
    } finally {
      setPendingKey(null)
      setOpenCalendarKey(null)
    }
  }

  const allInstances = useMemo(() => groups.flatMap((group) => group.instances), [groups])
  const totalMissing = allInstances.length

  const dateOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const instance of allInstances) {
      if (!seen.has(instance.date)) {
        const relative = relativeDayLabel(instance.date)
        seen.set(instance.date, `${formatDate(instance.date)}${relative ? ` · ${relative}` : ''}`)
      }
    }
    const entries = [...seen.entries()].sort(([a], [b]) => (a < b ? 1 : -1))
    return [{ value: ALL, label: 'All dates' }, ...entries.map(([value, label]) => ({ value, label }))]
  }, [allInstances])

  const categoryOptions = useMemo(() => {
    const names = [...new Set(allInstances.map((instance) => instance.categoryName))].sort()
    return [{ value: ALL, label: 'All categories' }, ...names.map((name) => ({ value: name, label: name }))]
  }, [allInstances])

  const filteredInstances = useMemo(() => {
    const q = taskSearch.trim().toLowerCase()
    return allInstances
      .filter((instance) => dateFilter === ALL || instance.date === dateFilter)
      .filter((instance) => categoryFilter === ALL || instance.categoryName === categoryFilter)
      .filter((instance) => !q || instance.taskName.toLowerCase().includes(q) || instance.categoryName.toLowerCase().includes(q))
      .sort(compareInstances)
  }, [allInstances, taskSearch, dateFilter, categoryFilter])

  return (
    <div className="missing-tasks-page">
      <div className="missing-tasks-page__body">
        {onBack && (
          <button type="button" className="missing-tasks-page__back" onClick={onBack}>
            <ChevronLeft size={16} aria-hidden="true" /> Back
          </button>
        )}
        <div className="missing-tasks-page__heading-row">
          <div>
            <h1 className="missing-tasks-page__heading">Missed Tasks</h1>
            <p className="missing-tasks-page__subtitle">Move tasks you missed on previous days onto a day you'll complete them.</p>
          </div>
          {!loading && !error && totalMissing > 0 && (
            <span className="missing-tasks-page__count">
              <CalendarPlus size={13} aria-hidden="true" />
              {totalMissing} missed
            </span>
          )}
        </div>

        {loading && <p className="missing-tasks-page__loading">Loading missed tasks…</p>}

        {!loading && error && (
          <div className="missing-tasks-page__empty">
            <AlertTriangle size={32} />
            <h2>Couldn't load missed tasks</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="missing-tasks-page__empty missing-tasks-page__empty--success">
            <CheckCircle2 size={32} />
            <h2>Nothing missed</h2>
            <p>Every scheduled task in the last 7 days has been completed.</p>
          </div>
        )}

        {!loading && !error && groups.length > 0 && (
          <>
            <div className="filter-bar">
              <div className="filter filter--search">
                <SearchInput value={taskSearch} onChange={setTaskSearch} placeholder="Search tasks…" variant="filter" />
              </div>
              <Select
                className="filter"
                options={dateOptions}
                value={dateFilter}
                onChange={setDateFilter}
                ariaLabel="Filter missed tasks by date"
              />
              <Select
                className="filter"
                options={categoryOptions}
                value={categoryFilter}
                onChange={setCategoryFilter}
                ariaLabel="Filter missed tasks by category"
              />
            </div>

            {filteredInstances.length === 0 ? (
              <div className="table-card">
                <p className="table-card__empty">No missed tasks match your filters.</p>
              </div>
            ) : (
              <div className="table-card">
                <div className="table-scroll">
                  <table className="data-table missing-tasks-table">
                    <thead>
                      <tr>
                        <th scope="col" className="missing-tasks-table__category-col">Category</th>
                        <th scope="col">Task</th>
                        <th scope="col">Date Missed</th>
                        <th scope="col" className="missing-tasks-table__actions-col">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredInstances.map((instance) => {
                        const key = instanceKey(instance)
                        const isPending = pendingKey === key
                        const rowError = rowErrors[key]
                        const relativeLabel = relativeDayLabel(instance.date)
                        const hasResponders = instance.completionType === 'MULTIPLE' && instance.completedByCount > 0

                        return (
                          <tr key={key}>
                            <td data-label="Category" className="missing-tasks-table__category-col">{instance.categoryName}</td>
                            <td data-label="Task">
                              <div className="missing-tasks-table__task-cell">
                                <span className="missing-tasks-table__task-name">{instance.taskName}</span>
                                <span className="missing-tasks-table__task-meta">
                                  {scheduleSummary(instance.scheduleType, instance.selectedDays, instance.taskStartDate, instance.taskEndDate)}
                                  {' · '}
                                  {responseTypeLabel(instance.responseType)}
                                </span>
                                {instance.description && <span className="missing-tasks-table__task-meta">{instance.description}</span>}
                                {hasResponders && (
                                  <span className="missing-tasks-table__task-meta">
                                    {instance.completedByCount}/{instance.totalActiveEmployees} responded
                                  </span>
                                )}
                                {rowError && <span className="missing-task-row__error">{rowError}</span>}
                              </div>
                            </td>
                            <td data-label="Date Missed">
                              <span className="missing-tasks-table__date-cell">
                                {formatDate(instance.date)}
                                {relativeLabel && <span className="missing-tasks-table__date-relative">{relativeLabel}</span>}
                              </span>
                            </td>
                            <td data-label="Actions" className="missing-tasks-table__actions-col">
                              {instance.state === 'ACTIONABLE' ? (
                                <button
                                  type="button"
                                  className="btn btn--dark btn--sm missing-tasks-table__move-btn"
                                  disabled={isPending}
                                  ref={(el) => {
                                    if (openCalendarKey === key) anchorRef.current = el
                                  }}
                                  onClick={() => setOpenCalendarKey((current) => (current === key ? null : key))}
                                >
                                  <CalendarPlus size={13} aria-hidden="true" />
                                  {isPending ? <ButtonDots label="Moving" /> : 'Move'}
                                </button>
                              ) : (
                                <span className="badge badge--warning">
                                  <Clock size={12} aria-hidden="true" /> Waiting on 2nd
                                </span>
                              )}
                              {openCalendarKey === key && (
                                <CalendarPopover
                                  value={todayKey}
                                  min={todayKey}
                                  max={maxTargetKey}
                                  isOpen
                                  onClose={() => setOpenCalendarKey(null)}
                                  onSelect={(date) => move(instance, date)}
                                  anchorRef={anchorRef}
                                />
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {!loading && !error && nextCursor && (
          <div className="missing-tasks-page__load-more">
            <button type="button" className="btn btn--secondary btn--sm" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? <ButtonDots label="Loading" /> : 'Load older missed tasks'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MissingTasks
