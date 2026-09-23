import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CalendarX, CheckCircle2, Clock, Link2, Users } from 'lucide-react'
import { ApiError } from '../api/client'
import { completeMissedTaskNow, getMissedTasks, linkMissedTaskToToday, unlinkMissedTask } from '../api/missedTasks'
import type { StoreSummary } from '../types/store'
import type { MissedTaskDateGroup, MissedTaskInstance } from '../types/missedTasks'
import { responseTypeLabel, scheduleSummary } from '../utils/adminTaskOptions'
import ButtonDots from '../components/ButtonDots'
import './MissingTasks.css'

interface MissingTasksProps {
  store: StoreSummary
  // Lets the caller (EmployeeShell) refresh its "Missing Tasks" nav badge and
  // dashboard banner right away after a completion, instead of waiting out
  // the poll interval.
  onCompleted?: () => void
}

const GENERIC_ERROR = "Couldn't save your response. Please try again."

function instanceKey(instance: MissedTaskInstance): string {
  return `${instance.taskId}:${instance.date}`
}

// Parsed as a local calendar date, not UTC midnight, so "yesterday" always
// reads as yesterday regardless of the viewer's timezone offset.
function parseLocalDate(date: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatGroupDate(date: string): string {
  return parseLocalDate(date).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

function formatShortDate(date: string): string {
  return formatGroupDate(date)
}

// Only the most recent missed date reads as "Yesterday" -- older groups just
// show their plain date, same as the reference layout.
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

// A stable-but-varied color per category name -- the same category always
// lands on the same tone, so it doubles as a quick visual grouping cue
// across rows without needing a legend. Dedicated colors (not the shared
// badge--info/success/etc tones) so tuning these can't shift the color of
// unrelated badges elsewhere in the app -- see the .missing-task-row__category--*
// rules in MissingTasks.css.
const CATEGORY_TONES = ['blue', 'green', 'yellow', 'purple', 'red'] as const

function categoryTone(categoryName: string): (typeof CATEGORY_TONES)[number] {
  let hash = 0
  for (let index = 0; index < categoryName.length; index++) {
    hash = (hash * 31 + categoryName.charCodeAt(index)) | 0
  }
  return CATEGORY_TONES[Math.abs(hash) % CATEGORY_TONES.length]
}

// Triage ordering within a date: tasks you can clear via today's checklist
// (no separate answer needed) sort first, then everything else still
// actionable, then tasks already in flight -- linked, or blocked on a second
// person -- at the bottom since they need no action from this employee right
// now. Response type is the tiebreaker within each group so the same kind of
// control repeats consecutively instead of jumping around the list.
function compareInstances(a: MissedTaskInstance, b: MissedTaskInstance): number {
  const priority = (instance: MissedTaskInstance): number => {
    if (instance.state === 'ACTIONABLE' && instance.canCompleteWithToday) return 0
    if (instance.state === 'ACTIONABLE') return 1
    if (instance.state === 'LINKED') return 2
    return 3
  }
  const priorityDiff = priority(a) - priority(b)
  if (priorityDiff !== 0) return priorityDiff
  return RESPONSE_TYPE_ORDER[a.responseType] - RESPONSE_TYPE_ORDER[b.responseType]
}

/**
 * Dedicated "Missing Tasks" page: past-day instances of this store's tasks
 * that were never completed, grouped by date, with actions to complete them
 * now or link them to today's occurrence of the same recurring task.
 */
function MissingTasks({ store, onCompleted }: MissingTasksProps) {
  const [groups, setGroups] = useState<MissedTaskDateGroup[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  // Cancels a still-in-flight load before starting another -- without this,
  // React's dev-mode double-invoked mount effect fires two real requests to
  // this (slow) endpoint for what is logically a single page load.
  const controllerRef = useRef<AbortController | null>(null)

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
            ? "You're not assigned to this store, so no missing tasks are available."
            : "Couldn't load missing tasks. Please try again."
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
      setError('Could not load older missing tasks. Please try again.')
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

  async function completeNow(instance: MissedTaskInstance, value: { booleanValue?: boolean; numericValue?: number; textValue?: string }) {
    const key = instanceKey(instance)
    if (pendingKey) return
    setPendingKey(key)
    setRowErrors((previous) => ({ ...previous, [key]: '' }))
    try {
      await completeMissedTaskNow(instance.taskId, instance.date, { storeId: store.id, ...value })
      // A completed instance is no longer missing -- drop it from the list
      // rather than refetching the whole page.
      replaceInstance(key, () => null)
      setDrafts((previous) => {
        const next = { ...previous }
        delete next[key]
        return next
      })
      onCompleted?.()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : GENERIC_ERROR
      setRowErrors((previous) => ({ ...previous, [key]: message }))
      if (err instanceof ApiError && err.status === 409) loadFirstPage()
    } finally {
      setPendingKey(null)
    }
  }

  async function linkToday(instance: MissedTaskInstance) {
    const key = instanceKey(instance)
    if (pendingKey) return
    setPendingKey(key)
    setRowErrors((previous) => ({ ...previous, [key]: '' }))
    try {
      const link = await linkMissedTaskToToday(instance.taskId, instance.date, store.id)
      replaceInstance(key, (current) => ({
        ...current,
        state: 'LINKED',
        canUnlink: true,
        linkedDate: link.linkedDate,
      }))
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't link this task to today. Please try again."
      setRowErrors((previous) => ({ ...previous, [key]: message }))
    } finally {
      setPendingKey(null)
    }
  }

  async function unlink(instance: MissedTaskInstance) {
    const key = instanceKey(instance)
    if (pendingKey) return
    setPendingKey(key)
    setRowErrors((previous) => ({ ...previous, [key]: '' }))
    try {
      await unlinkMissedTask(instance.taskId, instance.date, store.id)
      replaceInstance(key, (current) => ({
        ...current,
        state: 'ACTIONABLE',
        canUnlink: false,
        linkedDate: null,
      }))
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't remove this link. Please try again."
      setRowErrors((previous) => ({ ...previous, [key]: message }))
    } finally {
      setPendingKey(null)
    }
  }

  // A single "Complete" button (in the Actions column) drives every response
  // type -- Yes/No and Number/Text stage their answer in `drafts` first (the
  // input/requirement column), Done/Checkbox has nothing to stage and
  // completes directly.
  function submitDraft(instance: MissedTaskInstance) {
    const key = instanceKey(instance)
    if (instance.responseType === 'DONE_NOT_DONE') {
      completeNow(instance, { booleanValue: true })
      return
    }
    const draft = drafts[key]
    if (draft === undefined || draft === '') return
    if (instance.responseType === 'YES_NO') {
      completeNow(instance, { booleanValue: draft === 'true' })
    } else if (instance.responseType === 'NUMERIC') {
      const value = Number(draft)
      if (!Number.isFinite(value)) return
      completeNow(instance, { numericValue: value })
    } else if (instance.responseType === 'TEXT') {
      const trimmed = draft.trim()
      if (!trimmed) return
      completeNow(instance, { textValue: trimmed })
    }
  }

  const totalMissing = groups.reduce((sum, group) => sum + group.instances.length, 0)

  return (
    <div className="missing-tasks-page">
      <div className="missing-tasks-page__body">
        <div className="missing-tasks-page__heading-row">
          <div>
            <h1 className="missing-tasks-page__heading">Missing Tasks</h1>
            <p className="missing-tasks-page__subtitle">Catch up on tasks you missed on previous days.</p>
          </div>
          {!loading && !error && totalMissing > 0 && (
            <span className="missing-tasks-page__count">
              <CalendarX size={13} aria-hidden="true" />
              {totalMissing} missing
            </span>
          )}
        </div>

        {loading && <p className="missing-tasks-page__loading">Loading missing tasks…</p>}

        {!loading && error && (
          <div className="missing-tasks-page__empty">
            <AlertTriangle size={32} />
            <h2>Couldn't load missing tasks</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <div className="missing-tasks-page__empty missing-tasks-page__empty--success">
            <CheckCircle2 size={32} />
            <h2>Nothing missing</h2>
            <p>Every scheduled task in the last 90 days has been completed.</p>
          </div>
        )}

        {!loading && !error && groups.map((group) => {
          const relativeLabel = relativeDayLabel(group.date)
          return (
            <section key={group.date} className="missing-tasks-page__group">
              <div className="missing-tasks-page__group-header">
                <h2 className="missing-tasks-page__group-date">
                  {formatGroupDate(group.date)}
                  {relativeLabel && <span className="missing-tasks-page__group-relative">{relativeLabel}</span>}
                </h2>
                <span className="missing-tasks-page__group-count">
                  {group.instances.length} task{group.instances.length === 1 ? '' : 's'}
                </span>
              </div>

              <div className="missing-tasks-page__table-header">
                <span>Task information &amp; details</span>
                <span>Input / requirement</span>
                <span>Actions</span>
              </div>

              <div className="missing-tasks-page__list-card">
                {[...group.instances].sort(compareInstances).map((instance, index) => {
                  const key = instanceKey(instance)
                  const isPending = pendingKey === key
                  const rowError = rowErrors[key]
                  const draft = drafts[key]

                  return (
                    <div key={key} className="missing-task-row">
                      <div className="missing-task-row__col missing-task-row__col--info">
                        <span className="missing-task-row__index">{index + 1}</span>
                        <div className="missing-task-row__info">
                          <span className={`badge missing-task-row__category missing-task-row__category--${categoryTone(instance.categoryName)}`}>
                            {instance.categoryName}
                          </span>
                          <span className="missing-task-row__name">{instance.taskName}</span>
                          <span className="missing-task-row__meta">
                            {scheduleSummary(instance.scheduleType, instance.selectedDays, instance.taskStartDate, instance.taskEndDate)}
                            {' · '}
                            {responseTypeLabel(instance.responseType)}
                          </span>
                          {instance.completionType === 'MULTIPLE' && (
                            <span className="missing-task-row__multi">
                              <Users size={11} aria-hidden="true" />
                              {instance.completedByCount}/{instance.totalActiveEmployees} responded
                            </span>
                          )}
                          {rowError && <p className="missing-task-row__error">{rowError}</p>}
                        </div>
                      </div>

                      <div className="missing-task-row__col missing-task-row__col--input">
                        {instance.state === 'ACTIONABLE' && instance.responseType === 'YES_NO' && (
                          <div className="missing-task-row__btn-pair">
                            <button
                              type="button"
                              className={`btn btn--sm ${draft === 'false' ? 'btn--dark' : 'btn--secondary'}`}
                              disabled={isPending}
                              onClick={() => setDrafts((previous) => ({ ...previous, [key]: 'false' }))}
                            >
                              No
                            </button>
                            <button
                              type="button"
                              className={`btn btn--sm ${draft === 'true' ? 'btn--dark' : 'btn--secondary'}`}
                              disabled={isPending}
                              onClick={() => setDrafts((previous) => ({ ...previous, [key]: 'true' }))}
                            >
                              Yes
                            </button>
                          </div>
                        )}

                        {instance.state === 'ACTIONABLE' && instance.responseType === 'NUMERIC' && (
                          <div className="missing-task-row__input-wrap">
                            <input
                              type="number"
                              className="input missing-task-row__numeric-input"
                              disabled={isPending}
                              min={instance.numericMin ?? undefined}
                              max={instance.numericMax ?? undefined}
                              placeholder={
                                instance.numericMin != null && instance.numericMax != null
                                  ? `${instance.numericMin.toLocaleString()} – ${instance.numericMax.toLocaleString()}`
                                  : undefined
                              }
                              value={draft ?? ''}
                              onChange={(e) => setDrafts((previous) => ({ ...previous, [key]: e.target.value }))}
                            />
                            {instance.numericUnit && <span className="missing-task-row__unit">{instance.numericUnit}</span>}
                          </div>
                        )}

                        {instance.state === 'ACTIONABLE' && instance.responseType === 'TEXT' && (
                          <div className="missing-task-row__input-wrap">
                            <input
                              type="text"
                              className="input missing-task-row__text-input"
                              disabled={isPending}
                              maxLength={instance.textMaxLength ?? undefined}
                              placeholder={instance.responseNote ?? 'Enter your response…'}
                              value={draft ?? ''}
                              onChange={(e) => setDrafts((previous) => ({ ...previous, [key]: e.target.value }))}
                            />
                            {instance.textMaxLength != null && (
                              <span className="missing-task-row__char-count">{(draft ?? '').length}/{instance.textMaxLength}</span>
                            )}
                          </div>
                        )}

                        {instance.description && <span className="missing-task-row__hint">{instance.description}</span>}
                      </div>

                      <div className="missing-task-row__col missing-task-row__col--actions">
                        {instance.state === 'LINKED' && (
                          <>
                            <span className="badge badge--info">
                              <Link2 size={12} aria-hidden="true" /> Linked to today
                            </span>
                            <span className="missing-task-row__linked-by">
                              {instance.canUnlink ? 'Linked by you' : 'Linked by a teammate'}
                            </span>
                            {instance.canUnlink && (
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                disabled={isPending}
                                onClick={() => unlink(instance)}
                              >
                                {isPending ? <ButtonDots label="Removing" /> : 'Cancel link'}
                              </button>
                            )}
                          </>
                        )}

                        {instance.state === 'WAITING_ON_SECOND' && (
                          <>
                            <span className="badge badge--warning">
                              <Clock size={12} aria-hidden="true" /> Waiting on second person
                            </span>
                            <span className="missing-task-row__waiting-note">You responded · any teammate can finish it</span>
                          </>
                        )}

                        {instance.state === 'ACTIONABLE' && (
                          <>
                            <button
                              type="button"
                              className="btn btn--dark btn--sm"
                              disabled={isPending}
                              onClick={() => submitDraft(instance)}
                            >
                              {isPending ? <ButtonDots label="Saving" /> : 'Complete'}
                            </button>

                            {instance.canCompleteWithToday && (
                              <div className="missing-task-row__link-today">
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm missing-task-row__link-today-btn"
                                  disabled={isPending}
                                  onClick={() => linkToday(instance)}
                                  aria-describedby={`link-today-hint-${key}`}
                                >
                                  <Link2 size={13} aria-hidden="true" />
                                  {isPending ? <ButtonDots label="Linking" /> : 'Complete with Today'}
                                </button>
                                <span className="missing-task-row__link-today-hint" id={`link-today-hint-${key}`}>
                                  When today's task is marked complete, this one from {formatShortDate(instance.date)} is marked complete too.
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        {!loading && !error && nextCursor && (
          <div className="missing-tasks-page__load-more">
            <button type="button" className="btn btn--secondary btn--sm" disabled={loadingMore} onClick={loadMore}>
              {loadingMore ? <ButtonDots label="Loading" /> : 'Load older missing tasks'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default MissingTasks
