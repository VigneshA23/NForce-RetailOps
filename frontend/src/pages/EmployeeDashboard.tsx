import { useEffect, useMemo, useState } from 'react'
import { Blend, ChevronDown, ClipboardList, Flag, Lock, Sparkles } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getDailyChecklist, raiseIssue } from '../api/tasks'
import type { StoreSummary } from '../types/store'
import type { ChecklistCategory, TaskAnswer, TaskAnswers } from '../types/task'
import Modal from '../components/Modal'
import FormField from '../components/FormField'
import './EmployeeDashboard.css'

interface EmployeeDashboardProps {
  store: StoreSummary
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  preparation: Blend,
  cleaning: Sparkles,
  closing: Lock,
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function answersStorageKey(storeId: string): string {
  return `nforce-retailops-checklist-${storeId}-${todayKey()}`
}

function loadStoredAnswers(storeId: string): TaskAnswers {
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
  const [answers, setAnswers] = useState<TaskAnswers>(() => loadStoredAnswers(store.id))
  const [onDuty, setOnDuty] = useState(true)
  const [flagCount, setFlagCount] = useState(0)
  const [isRaiseModalOpen, setIsRaiseModalOpen] = useState(false)
  const [issueNote, setIssueNote] = useState('')
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    getDailyChecklist(store.id).then((result) => {
      if (active) {
        setCategories(result)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [store.id])

  useEffect(() => {
    localStorage.setItem(answersStorageKey(store.id), JSON.stringify(answers))
  }, [answers, store.id])

  const totalTasks = useMemo(() => categories.reduce((sum, category) => sum + category.tasks.length, 0), [categories])
  const completedTasks = useMemo(
    () => Object.values(answers).filter((answer) => answer === 'YES').length,
    [answers],
  )
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
  const remainingTasks = totalTasks - completedTasks

  function handleAnswer(taskId: string, value: TaskAnswer) {
    if (!onDuty) return
    setAnswers((previous) => ({ ...previous, [taskId]: value }))
  }

  function categoryProgress(category: ChecklistCategory): { done: number; total: number } {
    const done = category.tasks.filter((task) => answers[task.id] === 'YES').length
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

        <div className="employee-dashboard-summary">
          <div className="employee-dashboard-summary-item">
            <span className="employee-dashboard-summary-label">Completion</span>
            <span className="employee-dashboard-summary-value employee-dashboard-summary-value--accent">
              {completionPercent}%
            </span>
          </div>
          <div className="employee-dashboard-summary-item">
            <span className="employee-dashboard-summary-label">Tasks Done</span>
            <span className="employee-dashboard-summary-value">{completedTasks}</span>
          </div>
          <div className="employee-dashboard-summary-item">
            <span className="employee-dashboard-summary-label">Remaining</span>
            <span className="employee-dashboard-summary-value">{remainingTasks}</span>
          </div>
          <div className="employee-dashboard-summary-item">
            <span className="employee-dashboard-summary-label">Flags/Issues</span>
            <span className="employee-dashboard-summary-value employee-dashboard-summary-value--flag">
              {flagCount}
            </span>
          </div>
        </div>

        {loading && <p className="employee-dashboard-loading">Loading today's checklist…</p>}

        {!loading && categories.length === 0 && (
          <div className="employee-dashboard-empty">
            <ClipboardList size={32} />
            <h2>No checklist tasks yet</h2>
            <p>Your owner hasn't set up any categories or tasks for this store yet.</p>
          </div>
        )}

        {!loading && categories.length > 0 && (
          <div className="checklist-categories">
            {categories.map((category) => {
              const progress = categoryProgress(category)
              const Icon = CATEGORY_ICONS[category.id] ?? ClipboardList
              const isComplete = progress.total > 0 && progress.done === progress.total
              return (
                <details key={category.id} className="checklist-category" open>
                  <summary className="checklist-category-summary">
                    <div className="checklist-category-title">
                      <span className="checklist-category-icon">
                        <Icon size={18} />
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
                            <p className="checklist-task-status">
                              {answer === 'YES' ? '✓ Completed' : answer === 'NO' ? 'Not completed' : 'Not answered'}
                            </p>
                          </div>
                          <div className="checklist-task-actions">
                            <button
                              type="button"
                              className={`checklist-task-btn${answer === 'NO' ? ' checklist-task-btn--no-active' : ''}`}
                              disabled={!onDuty}
                              onClick={() => handleAnswer(task.id, 'NO')}
                            >
                              No
                            </button>
                            <button
                              type="button"
                              className={`checklist-task-btn${answer === 'YES' ? ' checklist-task-btn--yes-active' : ''}`}
                              disabled={!onDuty}
                              onClick={() => handleAnswer(task.id, 'YES')}
                            >
                              Yes
                            </button>
                          </div>
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
