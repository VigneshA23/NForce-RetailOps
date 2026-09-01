import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronDown, Circle, ClipboardList, Flag, ListTodo, Percent } from 'lucide-react'
import { ApiError } from '../api/client'
import { getDailyChecklist, raiseIssue } from '../api/tasks'
import type { StoreSummary } from '../types/store'
import type { ChecklistCategory, ChecklistTask, TaskAnswer, TaskAnswers } from '../types/task'
import { isAnswerComplete } from '../types/task'
import Modal from '../components/Modal'
import FormField from '../components/FormField'
import StatCard from '../components/StatCard'
import './EmployeeDashboard.css'

interface EmployeeDashboardProps {
  store: StoreSummary
  onLogout: () => void
  loggingOut?: boolean
}

function answerStatusLabel(task: ChecklistTask, answer: TaskAnswer | undefined): string {
  if (!answer) return 'Not answered'
  if (answer.responseType === 'YES_NO') return answer.value === 'YES' ? '✓ Completed' : 'Not completed'
  if (answer.responseType === 'DONE_NOT_DONE') return '✓ Completed'
  if (answer.responseType === 'TEXT') return answer.value.trim() ? `✓ ${answer.value.trim()}` : 'Not answered'
  if (answer.responseType === 'NUMERIC') {
    return Number.isFinite(answer.value) ? `✓ ${answer.value}${task.numericUnit ? ` ${task.numericUnit}` : ''}` : 'Not answered'
  }
  return 'Not answered'
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function answersStorageKey(storeId: number): string {
  return `nforce-retailops-checklist-${storeId}-${todayKey()}`
}

function loadStoredAnswers(storeId: number): TaskAnswers {
  try {
    const raw = localStorage.getItem(answersStorageKey(storeId))
    return raw ? (JSON.parse(raw) as TaskAnswers) : {}
  } catch {
    return {}
  }
}

function EmployeeDashboard({ store }: EmployeeDashboardProps) {
  const [categories, setCategories] = useState<ChecklistCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<TaskAnswers>(() => loadStoredAnswers(store.id))
  const [onDuty, setOnDuty] = useState(true)
  const [flagCount, setFlagCount] = useState(0)
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false)
  const [issueNote, setIssueNote] = useState('')
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false)

  useEffect(() => {
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
  }, [store.id])

  useEffect(() => {
    localStorage.setItem(answersStorageKey(store.id), JSON.stringify(answers))
  }, [answers, store.id])

  useEffect(() => {
    const knownTypes = new Set(['YES_NO', 'DONE_NOT_DONE', 'TEXT', 'NUMERIC'])
    categories.forEach((category) => {
      category.tasks.forEach((task) => {
        if (!knownTypes.has(task.responseType)) {
          console.warn(`Unsupported task response type "${task.responseType}" for task ${task.id}`)
        }
      })
    })
  }, [categories])

  const totalTasks = useMemo(() => categories.reduce((sum, category) => sum + category.tasks.length, 0), [categories])
  const completedTasks = useMemo(
    () => Object.values(answers).filter((answer) => isAnswerComplete(answer)).length,
    [answers],
  )
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
  const remainingTasks = totalTasks - completedTasks

  function setAnswer(taskId: number, answer: TaskAnswer) {
    if (!onDuty) return
    setAnswers((previous) => ({ ...previous, [taskId]: answer }))
  }

  function categoryProgress(category: ChecklistCategory): { done: number; total: number } {
    const done = category.tasks.filter((task) => isAnswerComplete(answers[task.id])).length
    return { done, total: category.tasks.length }
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
                      const answer = answers[task.id]
                      return (
                        <div key={task.id} className={`checklist-task${!onDuty ? ' checklist-task--disabled' : ''}`}>
                          <div>
                            <p className="checklist-task-name">{task.name}</p>
                            <p className="checklist-task-status">{answerStatusLabel(task, answer)}</p>
                          </div>

                          {task.responseType === 'YES_NO' && (
                            <div className="checklist-task-actions">
                              <button
                                type="button"
                                className={`checklist-task-btn${answer?.responseType === 'YES_NO' && answer.value === 'NO' ? ' checklist-task-btn--no-active' : ''}`}
                                disabled={!onDuty}
                                onClick={() => setAnswer(task.id, { responseType: 'YES_NO', value: 'NO' })}
                              >
                                No
                              </button>
                              <button
                                type="button"
                                className={`checklist-task-btn${answer?.responseType === 'YES_NO' && answer.value === 'YES' ? ' checklist-task-btn--yes-active' : ''}`}
                                disabled={!onDuty}
                                onClick={() => setAnswer(task.id, { responseType: 'YES_NO', value: 'YES' })}
                              >
                                Yes
                              </button>
                            </div>
                          )}

                          {task.responseType === 'DONE_NOT_DONE' && (
                            <div className="checklist-task-actions">
                              <button
                                type="button"
                                className={`checklist-task-btn${answer?.responseType === 'DONE_NOT_DONE' ? ' checklist-task-btn--yes-active' : ''}`}
                                disabled={!onDuty}
                                onClick={() => setAnswer(task.id, { responseType: 'DONE_NOT_DONE', value: true })}
                              >
                                {answer?.responseType === 'DONE_NOT_DONE' ? <CheckCircle2 size={16} /> : <Circle size={16} />}
                                Done
                              </button>
                            </div>
                          )}

                          {task.responseType === 'TEXT' && (
                            <input
                              type="text"
                              className="input checklist-task-text-input"
                              disabled={!onDuty}
                              maxLength={task.textMaxLength ?? undefined}
                              placeholder={task.responseNote ?? ''}
                              value={answer?.responseType === 'TEXT' ? answer.value : ''}
                              onChange={(event) => setAnswer(task.id, { responseType: 'TEXT', value: event.target.value })}
                            />
                          )}

                          {task.responseType === 'NUMERIC' && (
                            <div className="checklist-task-numeric">
                              <input
                                type="number"
                                className="input checklist-task-numeric-input"
                                disabled={!onDuty}
                                min={task.numericMin ?? undefined}
                                max={task.numericMax ?? undefined}
                                value={answer?.responseType === 'NUMERIC' ? answer.value : ''}
                                onChange={(event) => {
                                  const value = event.target.value === '' ? NaN : Number(event.target.value)
                                  setAnswer(task.id, { responseType: 'NUMERIC', value })
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
