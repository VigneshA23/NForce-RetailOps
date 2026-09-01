import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, ClipboardList, Flag, ListTodo, Percent } from 'lucide-react'
import { ApiError } from '../api/client'
import { getDailyChecklist, raiseIssue, submitTaskResponse, undoTaskResponse } from '../api/tasks'
import type { TaskResponseStateResponse } from '../api/tasks'
import { getMe } from '../api/me'
import type { StoreSummary } from '../types/store'
import type { ChecklistCategory, ChecklistTask, TaskResponseSummary } from '../types/task'
import Modal from '../components/Modal'
import FormField from '../components/FormField'
import StatCard from '../components/StatCard'
import './EmployeeDashboard.css'

interface EmployeeDashboardProps {
  store: StoreSummary
  onLogout: () => void
  loggingOut?: boolean
}

const GENERIC_TASK_ERROR = "Couldn't save your response. Please try again."

function ownResponse(task: ChecklistTask, employeeId: number | null): TaskResponseSummary | undefined {
  if (employeeId == null) return undefined
  // Repeats are allowed on MULTIPLE tasks, so an employee can have more than
  // one active entry -- the most recent one is the one Undo targets.
  const mine = task.responses.filter((response) => response.employeeUserId === employeeId)
  return mine[mine.length - 1]
}

function displayResponse(task: ChecklistTask, employeeId: number | null): TaskResponseSummary | undefined {
  return ownResponse(task, employeeId) ?? task.responses[task.responses.length - 1]
}

function responderLabel(response: TaskResponseSummary, employeeId: number | null): string {
  return response.employeeUserId === employeeId ? 'You' : response.employeeFullName
}

function formatTime(isoTimestamp: string): string {
  try {
    return new Date(isoTimestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  } catch {
    return ''
  }
}

// Tooltip for the completed/DONE status: who answered this task. SINGLE has at
// most one active response; MULTIPLE can have several, so all responders are
// listed. Safe against an empty or (defensively) missing responses array.
function responderTooltip(task: ChecklistTask): string | undefined {
  const names = (task.responses ?? []).map((response) => response.employeeFullName).filter(Boolean)
  if (names.length === 0) return undefined
  return task.completionType === 'MULTIPLE' ? `Completed by ${names.join(', ')}` : `Completed by ${names[0]}`
}

function answerStatusLabel(task: ChecklistTask, employeeId: number | null): string {
  const response = displayResponse(task, employeeId)
  if (!response) return 'Not answered'

  const who = responderLabel(response, employeeId)
  switch (task.responseType) {
    case 'YES_NO':
      return response.booleanValue ? `✓ Completed — ${who}` : `Not completed — ${who}`
    case 'DONE_NOT_DONE':
      return `✓ Completed — ${who}`
    case 'TEXT':
      return response.textValue && response.textValue.trim()
        ? `✓ ${response.textValue.trim()} — ${who}`
        : `✓ Completed — ${who}`
    case 'NUMERIC':
      return response.numericValue != null
        ? `✓ ${response.numericValue}${task.numericUnit ? ` ${task.numericUnit}` : ''} — ${who}`
        : 'Not answered'
    default:
      return 'Not answered'
  }
}

function EmployeeDashboard({ store }: EmployeeDashboardProps) {
  const [categories, setCategories] = useState<ChecklistCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [employeeId, setEmployeeId] = useState<number | null>(null)
  const [onDuty, setOnDuty] = useState(true)
  const [flagCount, setFlagCount] = useState(0)
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false)
  const [issueNote, setIssueNote] = useState('')
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false)
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null)
  const [taskErrors, setTaskErrors] = useState<Record<number, string>>({})
  const [drafts, setDrafts] = useState<Record<number, string>>({})

  function loadChecklist() {
    let active = true
    setLoading(true)
    setError(null)
    getDailyChecklist(store.id)
      .then((result) => {
        if (active) {
          setCategories(result)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (!active) return
        const message =
          err instanceof ApiError && err.status === 404
            ? "You're not assigned to this store, so no checklist is available."
            : "Couldn't load today's checklist. Please try again."
        setError(message)
        setCategories([])
        setLoading(false)
      })
    return () => {
      active = false
    }
  }

  useEffect(() => loadChecklist(), [store.id])

  useEffect(() => {
    let active = true
    getMe()
      .then((me) => {
        if (active) setEmployeeId(me.id)
      })
      .catch(() => {
        // Undo will simply stay unavailable if the profile can't be resolved.
      })
    return () => {
      active = false
    }
  }, [])

  const totalTasks = useMemo(() => categories.reduce((sum, category) => sum + category.tasks.length, 0), [categories])
  const completedTasks = useMemo(
    () => categories.reduce((sum, category) => sum + category.tasks.filter((task) => task.responses.length > 0).length, 0),
    [categories],
  )
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
  const remainingTasks = totalTasks - completedTasks

  function categoryProgress(category: ChecklistCategory): { done: number; total: number } {
    const done = category.tasks.filter((task) => task.responses.length > 0).length
    return { done, total: category.tasks.length }
  }

  function applyTaskState(state: TaskResponseStateResponse) {
    setCategories((previous) =>
      previous.map((category) => ({
        ...category,
        tasks: category.tasks.map((task) =>
          task.id === state.taskId ? { ...task, responses: state.responses, canUndo: state.canUndo } : task,
        ),
      })),
    )
  }

  async function submitAnswer(
    task: ChecklistTask,
    value: { booleanValue?: boolean; numericValue?: number; textValue?: string },
  ) {
    if (!onDuty || pendingTaskId != null) return
    setPendingTaskId(task.id)
    setTaskErrors((previous) => ({ ...previous, [task.id]: '' }))
    try {
      const state = await submitTaskResponse(task.id, { storeId: store.id, ...value })
      applyTaskState(state)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : GENERIC_TASK_ERROR
      setTaskErrors((previous) => ({ ...previous, [task.id]: message }))
      if (err instanceof ApiError && err.status === 409) {
        loadChecklist()
      }
    } finally {
      setPendingTaskId(null)
    }
  }

  async function undoAnswer(task: ChecklistTask) {
    const response = ownResponse(task, employeeId)
    if (!response || pendingTaskId != null) return
    setPendingTaskId(task.id)
    setTaskErrors((previous) => ({ ...previous, [task.id]: '' }))
    try {
      const state = await undoTaskResponse(task.id, response.id, store.id)
      applyTaskState(state)
      setDrafts((previous) => {
        const next = { ...previous }
        delete next[task.id]
        return next
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't undo this response. Please try again."
      setTaskErrors((previous) => ({ ...previous, [task.id]: message }))
      if (err instanceof ApiError && (err.status === 404 || err.status === 403)) {
        loadChecklist()
      }
    } finally {
      setPendingTaskId(null)
    }
  }

  function submitTextDraft(task: ChecklistTask) {
    const draft = drafts[task.id]
    if (draft === undefined) return
    const trimmed = draft.trim()
    const current = ownResponse(task, employeeId)
    if (!trimmed || trimmed === (current?.textValue ?? '')) return
    submitAnswer(task, { textValue: trimmed })
  }

  function submitNumericDraft(task: ChecklistTask) {
    const draft = drafts[task.id]
    if (draft === undefined) return
    const value = draft === '' ? NaN : Number(draft)
    const current = ownResponse(task, employeeId)
    if (!Number.isFinite(value) || value === current?.numericValue) return
    submitAnswer(task, { numericValue: value })
  }

  async function handleSubmitIssue() {
    const note = issueNote.trim()
    if (!note) return
    setIsSubmittingIssue(true)
    try {
      await raiseIssue(store.id, note)
      setFlagCount((count) => count + 1)
      setIssueNote('')
      setIsRaiseModalOpen(false)
    } finally {
      setIsSubmittingIssue(false)
    }
  }

  return (
    <div className="employee-dashboard">
      <div className="employee-dashboard-body">
        <div className="employee-dashboard-heading-row">
          <div>
            <h1 className="employee-dashboard-heading">Today's Tasks</h1>
            <p className="employee-dashboard-subheading">
              Overall: {completedTasks}/{totalTasks}
            </p>
          </div>
          <label className="on-duty-toggle">
            <span className="on-duty-toggle-label">On Duty</span>
            <input
              type="checkbox"
              checked={onDuty}
              onChange={(event) => setOnDuty(event.target.checked)}
            />
            <span className="on-duty-toggle-track" aria-hidden="true">
              <span className="on-duty-toggle-thumb" />
            </span>
          </label>
        </div>

        <div className="stat-card-row employee-dashboard-summary">
          <StatCard icon={Percent} label="Completion" value={`${completionPercent}%`} tone="primary" />
          <StatCard icon={CheckCircle2} label="Tasks Done" value={completedTasks} tone="success" />
          <StatCard icon={ListTodo} label="Remaining" value={remainingTasks} tone="info" />
          <StatCard icon={Flag} label="Flags/Issues" value={flagCount} tone="warning" />
        </div>

        {loading && <p className="employee-dashboard-loading">Loading today's checklist…</p>}

        {!loading && error && (
          <div className="employee-dashboard-empty">
            <AlertTriangle size={32} />
            <h2>Couldn't load checklist</h2>
            <p>{error}</p>
          </div>
        )}

        {!loading && !error && categories.length === 0 && (
          <div className="employee-dashboard-empty">
            <ClipboardList size={32} />
            <h2>No checklist tasks yet</h2>
            <p>Your owner hasn't set up any categories or tasks for this store yet.</p>
          </div>
        )}

        {!loading && !error && categories.length > 0 && (
          <div className="checklist-categories">
            {categories.map((category) => {
              const progress = categoryProgress(category)
              const isComplete = progress.total > 0 && progress.done === progress.total
              return (
                <details key={category.id} className="checklist-category" open>
                  <summary className="checklist-category-summary">
                    <div className="checklist-category-title">
                      <span className="checklist-category-icon">
                        <ClipboardList size={18} />
                      </span>
                      <h3>{category.name}</h3>
                    </div>
                    <div className="checklist-category-meta">
                      <span className={`checklist-category-count${isComplete ? ' checklist-category-count--complete' : ''}`}>
                        {progress.done}/{progress.total}
                      </span>
                      <ChevronDown size={18} className="checklist-category-chevron" />
                    </div>
                  </summary>

                  <div className="checklist-tasks">
                    {category.tasks.map((task) => {
                      const isPending = pendingTaskId === task.id
                      const isSingleLocked = task.completionType === 'SINGLE' && task.responses.length > 0
                      // A SINGLE task someone else already answered: fully locked, no
                      // interactive control is rendered at all -- only Undo (gated on
                      // canUndo) can ever reopen it, and only for whoever owns it.
                      const isLockedByOther = isSingleLocked && !task.canUndo
                      const controlsDisabled = !onDuty || isPending || isSingleLocked
                      const mine = ownResponse(task, employeeId)
                      const draft = drafts[task.id]
                      const taskError = taskErrors[task.id]

                      return (
                        <div key={task.id} className={`checklist-task${!onDuty ? ' checklist-task--disabled' : ''}`}>
                          <div>
                            <p className="checklist-task-name">{task.name}</p>
                            <p className="checklist-task-status" title={responderTooltip(task)}>
                              {answerStatusLabel(task, employeeId)}
                            </p>
                            {taskError && <p className="checklist-task-error">{taskError}</p>}
                          </div>

                          <div className="checklist-task-controls">
                            {isLockedByOther ? (
                              <span className="checklist-task-done-badge" title={responderTooltip(task)}>
                                DONE
                              </span>
                            ) : (
                              <>
                                {task.responseType === 'YES_NO' && (
                                  <div className="checklist-task-actions">
                                    <button
                                      type="button"
                                      className={`checklist-task-btn${mine?.booleanValue === false ? ' checklist-task-btn--no-active' : ''}`}
                                      disabled={controlsDisabled}
                                      onClick={() => submitAnswer(task, { booleanValue: false })}
                                    >
                                      No
                                    </button>
                                    <button
                                      type="button"
                                      className={`checklist-task-btn${mine?.booleanValue === true ? ' checklist-task-btn--yes-active' : ''}`}
                                      disabled={controlsDisabled}
                                      onClick={() => submitAnswer(task, { booleanValue: true })}
                                    >
                                      Yes
                                    </button>
                                  </div>
                                )}

                                {task.responseType === 'DONE_NOT_DONE' && (
                                  <div className="checklist-task-actions">
                                    <button
                                      type="button"
                                      className={`checklist-task-btn${mine ? ' checklist-task-btn--yes-active' : ''}`}
                                      disabled={controlsDisabled}
                                      onClick={() => submitAnswer(task, { booleanValue: true })}
                                    >
                                      {mine ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                      Done
                                    </button>
                                  </div>
                                )}

                                {task.responseType === 'TEXT' && (
                                  <input
                                    type="text"
                                    className="input checklist-task-text-input"
                                    disabled={controlsDisabled}
                                    maxLength={task.textMaxLength ?? undefined}
                                    placeholder={task.responseNote ?? ''}
                                    value={draft ?? mine?.textValue ?? ''}
                                    onChange={(event) => setDrafts((previous) => ({ ...previous, [task.id]: event.target.value }))}
                                    onBlur={() => submitTextDraft(task)}
                                    onKeyDown={(event) => {
                                      if (event.key === 'Enter') event.currentTarget.blur()
                                    }}
                                  />
                                )}

                                {task.responseType === 'NUMERIC' && (
                                  <div className="checklist-task-numeric">
                                    <input
                                      type="number"
                                      className="input checklist-task-numeric-input"
                                      disabled={controlsDisabled}
                                      min={task.numericMin ?? undefined}
                                      max={task.numericMax ?? undefined}
                                      value={draft ?? (mine?.numericValue != null ? String(mine.numericValue) : '')}
                                      onChange={(event) => setDrafts((previous) => ({ ...previous, [task.id]: event.target.value }))}
                                      onBlur={() => submitNumericDraft(task)}
                                      onKeyDown={(event) => {
                                        if (event.key === 'Enter') event.currentTarget.blur()
                                      }}
                                    />
                                    {task.numericUnit && <span className="checklist-task-unit">{task.numericUnit}</span>}
                                  </div>
                                )}

                                {task.responseType !== 'YES_NO' &&
                                  task.responseType !== 'DONE_NOT_DONE' &&
                                  task.responseType !== 'TEXT' &&
                                  task.responseType !== 'NUMERIC' && (
                                    <p className="checklist-task-status">Unsupported response type</p>
                                  )}
                              </>
                            )}

                            {task.canUndo && (
                              <button
                                type="button"
                                className="checklist-task-undo-link"
                                disabled={!onDuty || isPending}
                                onClick={() => undoAnswer(task)}
                              >
                                Undo
                              </button>
                            )}
                          </div>

                          {task.completionType === 'MULTIPLE' && task.responses.length > 1 && (
                            <ul className="checklist-task-responses">
                              {task.responses.map((response) => (
                                <li key={response.id}>
                                  {responderLabel(response, employeeId)} · {formatTime(response.respondedAt)}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </details>
              )
            })}
          </div>
        )}
      </div>

      <button type="button" className="raise-with-owner-fab" onClick={() => setIsRaiseModalOpen(true)}>
        <Flag size={16} />
        Raise with Owner
      </button>

      <Modal
        isOpen={isRaiseModalOpen}
        onClose={() => setIsRaiseModalOpen(false)}
        title="Raise an issue with the owner"
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
        <FormField label="What's the issue?" htmlFor="issue-note">
          <textarea
            id="issue-note"
            className="input"
            rows={4}
            value={issueNote}
            onChange={(event) => setIssueNote(event.target.value)}
            placeholder="Describe what needs the owner's attention..."
            autoFocus
          />
        </FormField>
      </Modal>
    </div>
  )
}

export default EmployeeDashboard
