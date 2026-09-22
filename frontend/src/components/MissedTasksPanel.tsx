import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, Clock, Link2, Users } from 'lucide-react'
import { ApiError } from '../api/client'
import { completeMissedTaskNow, getMissedTasks, linkMissedTaskToToday, unlinkMissedTask } from '../api/missedTasks'
import type { StoreSummary } from '../types/store'
import type { MissedTaskDateGroup, MissedTaskInstance } from '../types/missedTasks'
import ButtonDots from './ButtonDots'
// Reuses EmployeeDashboard's response-control classes (checklist-task-btn,
// checklist-task__input-row, ...) so a task's answer controls look identical
// whether it's answered on today's checklist or completed here as a makeup.
import '../pages/EmployeeDashboard.css'
import './MissedTasksPanel.css'

interface MissedTasksPanelProps {
  store: StoreSummary
}

const GENERIC_ERROR = "Couldn't save your response. Please try again."

function instanceKey(instance: MissedTaskInstance): string {
  return `${instance.taskId}:${instance.date}`
}

function formatGroupDate(date: string): string {
  // Parsed as a local calendar date, not UTC midnight, so "yesterday" always
  // reads as yesterday regardless of the viewer's timezone offset.
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })
}

/**
 * Employee-facing analogue of the Owner/Admin "Outstanding Tasks" collapsible
 * section (see StoreDetail.tsx's store-detail-outstanding block): a toggle
 * header with a count pill that expands in place to show each missed instance
 * and its actions, rather than navigating to a separate page. Hides itself
 * entirely once the initial load confirms there is nothing missed.
 */
function MissedTasksPanel({ store }: MissedTasksPanelProps) {
  const [groups, setGroups] = useState<MissedTaskDateGroup[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendingKey, setPendingKey] = useState<string | null>(null)
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [open, setOpen] = useState(false)
  // Whether the very first load ever found anything missed -- once true, the
  // section stays visible (even as the live count drops to 0 while the
  // employee works through it) instead of vanishing mid-interaction.
  const [everHadMissed, setEverHadMissed] = useState(false)
  const hasAutoOpened = useRef(false)

  function loadFirstPage() {
    let active = true
    setLoading(true)
    setError(null)
    getMissedTasks(store.id)
      .then((page) => {
        if (!active) return
        setGroups(page.groups)
        setNextCursor(page.nextCursor)
        setLoading(false)
        if (page.totalInstances > 0) {
          setEverHadMissed(true)
          // Open by default the first time there's something to act on, the
          // same way StoreDetail's Outstanding Tasks panel opens automatically
          // when issues exist -- but never re-force it open after that, so a
          // manual collapse during this session sticks.
          if (!hasAutoOpened.current) {
            hasAutoOpened.current = true
            setOpen(true)
          }
        }
      })
      .catch((err) => {
        if (!active) return
        const message =
          err instanceof ApiError && err.status === 404
            ? "You're not assigned to this store, so no missed tasks are available."
            : "Couldn't load missed tasks. Please try again."
        setError(message)
        setGroups([])
        setLoading(false)
      })
    return () => { active = false }
  }

  useEffect(() => loadFirstPage(), [store.id])

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

  async function completeNow(instance: MissedTaskInstance, value: { booleanValue?: boolean; numericValue?: number; textValue?: string }) {
    const key = instanceKey(instance)
    if (pendingKey) return
    setPendingKey(key)
    setRowErrors((previous) => ({ ...previous, [key]: '' }))
    try {
      await completeMissedTaskNow(instance.taskId, instance.date, { storeId: store.id, ...value })
      // A completed instance is no longer missed -- drop it from the list rather
      // than refetching the whole page.
      replaceInstance(key, () => null)
      setDrafts((previous) => {
        const next = { ...previous }
        delete next[key]
        return next
      })
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

  function submitDraft(instance: MissedTaskInstance) {
    const key = instanceKey(instance)
    const draft = drafts[key]
    if (draft === undefined || draft === '') return
    if (instance.responseType === 'NUMERIC') {
      const value = Number(draft)
      if (!Number.isFinite(value)) return
      completeNow(instance, { numericValue: value })
    } else if (instance.responseType === 'TEXT') {
      const trimmed = draft.trim()
      if (!trimmed) return
      completeNow(instance, { textValue: trimmed })
    }
  }

  // Nothing missed on the very first load: stay out of the way entirely,
  // same as StoreDetail's `{outstandingRows.length > 0 && (...)}` guard.
  if (!loading && !error && !everHadMissed) return null

  const totalMissed = groups.reduce((sum, group) => sum + group.instances.length, 0)

  return (
    <div className="missed-tasks-panel">
      <button
        type="button"
        className="missed-tasks-panel__toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="missed-tasks-panel__title">
          Missed Tasks
          {!loading && !error && <span className="missed-tasks-panel__count">{totalMissed}</span>}
        </span>
        <ChevronDown
          size={14}
          className={`missed-tasks-panel__chevron${open ? ' missed-tasks-panel__chevron--open' : ''}`}
        />
      </button>

      {open && (
        <div className="missed-tasks-panel__body">
          {loading && <p className="missed-tasks-panel__loading">Loading missed tasks…</p>}

          {!loading && error && (
            <div className="missed-tasks-panel__empty">
              <AlertTriangle size={28} />
              <p>{error}</p>
            </div>
          )}

          {!loading && !error && groups.length === 0 && (
            <div className="missed-tasks-panel__empty missed-tasks-panel__empty--success">
              <CheckCircle2 size={28} />
              <p>Nothing missed -- every scheduled task in the last 90 days has been completed.</p>
            </div>
          )}

          {!loading && !error && groups.map((group) => (
            <section key={group.date} className="missed-tasks-panel__group">
              <h3 className="missed-tasks-panel__group-date">{formatGroupDate(group.date)}</h3>
              <div className="missed-tasks-panel__list">
                {group.instances.map((instance) => {
                  const key = instanceKey(instance)
                  const isPending = pendingKey === key
                  const rowError = rowErrors[key]
                  const draft = drafts[key]

                  return (
                    <div key={key} className="missed-task-row">
                      <div className="missed-task-row__info">
                        <span className="missed-task-row__name">{instance.taskName}</span>
                        {instance.description && <span className="missed-task-row__description">{instance.description}</span>}
                        {instance.completionType === 'MULTIPLE' && (
                          <span className="missed-task-row__multi">
                            <Users size={12} aria-hidden="true" />
                            {instance.completedByCount}/{instance.totalActiveEmployees} responded
                          </span>
                        )}
                        {rowError && <span className="missed-task-row__error">{rowError}</span>}
                      </div>

                      <div className="missed-task-row__actions">
                        {instance.state === 'LINKED' && (
                          <div className="missed-task-row__linked">
                            <span className="badge badge--info">
                              <Link2 size={12} aria-hidden="true" /> Linked to today
                            </span>
                            {instance.canUnlink && (
                              <button
                                type="button"
                                className="btn btn--secondary btn--sm"
                                disabled={isPending}
                                onClick={() => unlink(instance)}
                              >
                                {isPending ? <ButtonDots label="Removing" /> : 'Unlink'}
                              </button>
                            )}
                          </div>
                        )}

                        {instance.state === 'WAITING_ON_SECOND' && (
                          <span className="badge badge--outline">
                            <Clock size={12} aria-hidden="true" /> Waiting on second person
                          </span>
                        )}

                        {instance.state === 'ACTIONABLE' && (
                          <>
                            {instance.responseType === 'YES_NO' && (
                              <div className="checklist-task__btn-pair">
                                <button
                                  type="button"
                                  className="checklist-task-btn checklist-task-btn--no"
                                  disabled={isPending}
                                  onClick={() => completeNow(instance, { booleanValue: false })}
                                >
                                  No
                                </button>
                                <button
                                  type="button"
                                  className="checklist-task-btn checklist-task-btn--yes"
                                  disabled={isPending}
                                  onClick={() => completeNow(instance, { booleanValue: true })}
                                >
                                  Yes
                                </button>
                              </div>
                            )}

                            {instance.responseType === 'DONE_NOT_DONE' && (
                              <button
                                type="button"
                                className="checklist-task-btn checklist-task-btn--full"
                                disabled={isPending}
                                onClick={() => completeNow(instance, { booleanValue: true })}
                              >
                                {isPending ? <ButtonDots label="Saving" /> : <><Circle size={15} /> Mark as Done</>}
                              </button>
                            )}

                            {instance.responseType === 'NUMERIC' && (
                              <div className="checklist-task__input-row">
                                <input
                                  type="number"
                                  className="input checklist-task__numeric-input"
                                  disabled={isPending}
                                  min={instance.numericMin ?? undefined}
                                  max={instance.numericMax ?? undefined}
                                  value={draft ?? ''}
                                  onChange={(e) => setDrafts((previous) => ({ ...previous, [key]: e.target.value }))}
                                />
                                {instance.numericUnit && <span className="checklist-task__unit">{instance.numericUnit}</span>}
                                <button
                                  type="button"
                                  className="btn btn--secondary btn--sm"
                                  disabled={isPending || !draft}
                                  onClick={() => submitDraft(instance)}
                                >
                                  {isPending ? <ButtonDots label="Saving" /> : 'Complete Now'}
                                </button>
                              </div>
                            )}

                            {instance.responseType === 'TEXT' && (
                              <div className="checklist-task__input-row">
                                <input
                                  type="text"
                                  className="input checklist-task__text-input"
                                  disabled={isPending}
                                  maxLength={instance.textMaxLength ?? undefined}
                                  placeholder={instance.responseNote ?? 'Enter your response…'}
                                  value={draft ?? ''}
                                  onChange={(e) => setDrafts((previous) => ({ ...previous, [key]: e.target.value }))}
                                />
                                <button
                                  type="button"
                                  className="btn btn--secondary btn--sm"
                                  disabled={isPending || !draft}
                                  onClick={() => submitDraft(instance)}
                                >
                                  {isPending ? <ButtonDots label="Saving" /> : 'Complete Now'}
                                </button>
                              </div>
                            )}

                            {instance.canCompleteWithToday && (
                              <div className="missed-task-row__link-today">
                                <button
                                  type="button"
                                  className="btn btn--ghost btn--sm"
                                  disabled={isPending}
                                  onClick={() => linkToday(instance)}
                                >
                                  {isPending ? <ButtonDots label="Linking" /> : 'Complete with Today'}
                                </button>
                                <span className="missed-task-row__link-today-hint">
                                  When today's task is marked complete, this one from {instance.date} is marked complete too.
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
          ))}

          {!loading && !error && nextCursor && (
            <div className="missed-tasks-panel__load-more">
              <button type="button" className="btn btn--secondary btn--sm" disabled={loadingMore} onClick={loadMore}>
                {loadingMore ? <ButtonDots label="Loading" /> : 'Load older missed tasks'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default MissedTasksPanel
