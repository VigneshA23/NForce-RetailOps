import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Circle,
  ClipboardList,
  Flag,
  Info,
  ListTodo,
  MessageSquareWarning,
  Percent,
} from 'lucide-react'
import { ApiError } from '../api/client'
import { getDailyChecklist, submitTaskResponse, undoTaskResponse } from '../api/tasks'
import type { TaskResponseStateResponse } from '../api/tasks'
import type { StoreSummary } from '../types/store'
import type { ChecklistCategory, ChecklistTask, TaskResponseSummary } from '../types/task'
import StatCard from '../components/StatCard'
import SearchInput from '../components/SearchInput'
import { useIsMobile } from '../hooks/useMediaQuery'
import './EmployeeDashboard.css'
import '../styles/filters.css'

interface EmployeeDashboardProps {
  store: StoreSummary
  onLogout: () => void
  loggingOut?: boolean
  employeeId: number | null
  employeeName?: string
  onNavigate?: (tab: 'audits' | 'issues') => void
}

function todayDateKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

function localDraftKey(storeId: number, taskId: number, date: string): string {
  return `draft:${storeId}:${taskId}:${date}`
}

interface CategoryProgressGridItem {
  id: number
  name: string
  done: number
  total: number
}

function CategoryProgressGrid({ items }: { items: CategoryProgressGridItem[] }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => { setAnimated(true) }, [])

  return (
    <div className="category-progress-grid">
      {items.map(({ id, name, done, total }) => {
        const complete = total > 0 && done === total
        const inProgress = done > 0 && !complete
        const percent = total === 0 ? 0 : Math.round((done / total) * 100)
        const tone = complete ? ' category-progress-card--complete' : inProgress ? ' category-progress-card--progress' : ''
        return (
          <div key={id} className={`category-progress-card${tone}`}>
            <span className="category-progress-card__name">{name}</span>
            <div className="category-progress-card__fraction">
              <span className="category-progress-card__done">{done}</span>
              <span className="category-progress-card__sep">/{total}</span>
            </div>
            <div
              className="category-progress-card__bar"
              role="progressbar"
              aria-valuenow={percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${name}: ${done} of ${total} done`}
            >
              <div
                className="category-progress-card__fill"
                style={{ width: animated ? `${percent}%` : '0%' }}
              />
            </div>
            {complete && <span className="category-progress-card__badge">All done</span>}
          </div>
        )
      })}
    </div>
  )
}

interface MultiSelectDropdownProps {
  options: Array<{ id: number; label: string }>
  selected: Set<number>
  onChange: (next: Set<number>) => void
  placeholder?: string
}

interface SingleSelectDropdownProps<T extends string> {
  options: Array<{ value: T | null; label: string }>
  value: T | null
  onChange: (next: T | null) => void
  placeholder?: string
}

function SingleSelectDropdown<T extends string>({ options, value, onChange, placeholder }: SingleSelectDropdownProps<T>) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const label = options.find((o) => o.value === value)?.label ?? placeholder ?? 'All'

  return (
    <div ref={ref} className="multi-select">
      <button
        type="button"
        className={`multi-select__trigger${open ? ' multi-select__trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown size={14} className={`multi-select__chevron${open ? ' multi-select__chevron--up' : ''}`} />
      </button>
      {open && (
        <div className="multi-select__panel" role="listbox">
          {options.map((opt) => (
            <button
              key={String(opt.value)}
              type="button"
              role="option"
              aria-selected={value === opt.value}
              className={`multi-select__option multi-select__option--single${value === opt.value ? ' multi-select__option--selected' : ''}`}
              onClick={() => { onChange(opt.value); setOpen(false) }}
            >
              {opt.value === null ? (
                <span style={{ fontWeight: 600 }}>{opt.label}</span>
              ) : (
                <span>{opt.label}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MultiSelectDropdown({ options, selected, onChange, placeholder = 'All Categories' }: MultiSelectDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  function toggle(id: number) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const label =
    selected.size === 0
      ? placeholder
      : `${selected.size} categor${selected.size === 1 ? 'y' : 'ies'} selected`

  return (
    <div ref={ref} className="multi-select">
      <button
        type="button"
        className={`multi-select__trigger${open ? ' multi-select__trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        <ChevronDown size={14} className={`multi-select__chevron${open ? ' multi-select__chevron--up' : ''}`} />
      </button>
      {open && (
        <div className="multi-select__panel" role="listbox" aria-multiselectable="true">
          <label className="multi-select__option multi-select__option--all">
            <input
              type="checkbox"
              checked={selected.size === 0}
              onChange={() => onChange(new Set())}
            />
            <span>All Categories</span>
          </label>
          <div className="multi-select__divider" />
          {options.map((opt) => (
            <label key={opt.id} className="multi-select__option">
              <input
                type="checkbox"
                checked={selected.has(opt.id)}
                onChange={() => toggle(opt.id)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

const GENERIC_TASK_ERROR = "Couldn't save your response. Please try again."

function ownResponse(task: ChecklistTask, employeeId: number | null): TaskResponseSummary | undefined {
  if (employeeId == null) return undefined
  const mine = task.responses.filter((response) => response.employeeUserId === employeeId)
  return mine[mine.length - 1]
}

function responderTooltip(task: ChecklistTask): string | undefined {
  const names = (task.responses ?? []).map((response) => response.employeeFullName).filter(Boolean)
  if (names.length === 0) return undefined
  return task.completionType === 'MULTIPLE' ? `Completed by ${names.join(', ')}` : `Completed by ${names[0]}`
}

function completedByNamesForTooltip(task: ChecklistTask): string[] {
  const names = task.completedByNames ?? []
  return names.length > 0 ? names : ['No active employee has completed this yet']
}

function showsCompletedByCount(task: ChecklistTask): boolean {
  return task.completionType === 'MULTIPLE' && task.completedByCount > 0
}

function EmployeeDashboard({ store, employeeId, employeeName, onNavigate }: EmployeeDashboardProps) {
  const isMobile = useIsMobile()
  const [categories, setCategories] = useState<ChecklistCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingTaskId, setPendingTaskId] = useState<number | null>(null)
  const [undoingTaskId, setUndoingTaskId] = useState<number | null>(null)
  const [taskErrors, setTaskErrors] = useState<Record<number, string>>({})
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [openCompletedByTaskId, setOpenCompletedByTaskId] = useState<number | null>(null)
  const [taskSearch, setTaskSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<Set<number>>(new Set())
  const [statusFilter, setStatusFilter] = useState<'complete' | 'open' | 'needs-correction' | null>(null)
  // Controlled open state: desktop = all open by default, mobile = all closed
  const [openCategories, setOpenCategories] = useState<Set<number>>(new Set())
  const categoriesInitialized = useRef(false)
  useEffect(() => {
    if (categoriesInitialized.current || categories.length === 0) return
    categoriesInitialized.current = true
    if (!isMobile) setOpenCategories(new Set(categories.map((c) => c.id)))
  }, [categories, isMobile])

  function toggleCategory(id: number, isOpen: boolean) {
    setOpenCategories((prev) => {
      const next = new Set(prev)
      if (isOpen) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function loadChecklist() {
    let active = true
    setLoading(true)
    setError(null)
    getDailyChecklist(store.id)
      .then((result) => {
        if (active) {
          setCategories(result)
          const today = todayDateKey()
          const seeded: Record<number, string> = {}
          for (const cat of result) {
            for (const task of cat.tasks) {
              if (task.responseType !== 'TEXT' || task.responses.length > 0) continue
              const saved = localStorage.getItem(localDraftKey(store.id, task.id, today))
              if (saved) seeded[task.id] = saved
            }
          }
          if (Object.keys(seeded).length > 0) setDrafts(seeded)
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
    return () => { active = false }
  }

  useEffect(() => loadChecklist(), [store.id])

  useEffect(() => {
    const today = todayDateKey()
    const prefix = `draft:${store.id}:`
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(prefix) && !key.endsWith(`:${today}`)) toRemove.push(key)
    }
    toRemove.forEach((key) => localStorage.removeItem(key))
  }, [store.id])

  useEffect(() => {
    if (Object.keys(drafts).length === 0) return
    const today = todayDateKey()
    const timeout = setTimeout(() => {
      for (const [taskId, value] of Object.entries(drafts)) {
        const key = localDraftKey(store.id, Number(taskId), today)
        if (value) localStorage.setItem(key, value)
        else localStorage.removeItem(key)
      }
    }, 500)
    return () => clearTimeout(timeout)
  }, [drafts, store.id])

  const totalTasks = useMemo(() => categories.reduce((sum, cat) => sum + cat.tasks.length, 0), [categories])
  const completedTasks = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.tasks.filter((task) => {
      if (task.responses.length === 0) return false
      const mine = ownResponse(task, employeeId)
      if (mine?.flaggedNeedsCorrection) return false
      return true
    }).length, 0),
    [categories, employeeId],
  )
  const completionPercent = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100)
  const remainingTasks = totalTasks - completedTasks
  const flagCount = useMemo(
    () => categories.reduce((sum, cat) => sum + cat.tasks.filter((task) => {
      const mine = ownResponse(task, employeeId)
      return mine?.flaggedNeedsCorrection === true
    }).length, 0),
    [categories, employeeId],
  )
  const isAllDone = completedTasks === totalTasks && totalTasks > 0

  const filteredCategories = useMemo(() => {
    const q = taskSearch.trim().toLowerCase()
    const hasFilter = q || categoryFilter.size > 0 || statusFilter !== null
    if (!hasFilter) return categories
    return categories
      .filter((cat) => categoryFilter.size === 0 || categoryFilter.has(cat.id))
      .map((cat) => ({
        ...cat,
        tasks: cat.tasks.filter((task) => {
          const mine = ownResponse(task, employeeId)
          const isFlagged = mine?.flaggedNeedsCorrection === true
          const isDone = task.responses.length > 0 && !isFlagged
          const isOpen = task.responses.length === 0
          if (statusFilter === 'complete' && !isDone) return false
          if (statusFilter === 'open' && !isOpen) return false
          if (statusFilter === 'needs-correction' && !isFlagged) return false
          if (q) return task.name.toLowerCase().includes(q) || cat.name.toLowerCase().includes(q)
          return true
        }),
      }))
      .filter((cat) => cat.tasks.length > 0)
  }, [categories, taskSearch, categoryFilter, statusFilter, employeeId])

  const stripItems = useMemo(
    () => categories.map((cat) => ({ id: cat.id, name: cat.name, ...categoryProgress(cat) })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [categories, employeeId],
  )

  const todayLabel = useMemo(
    () => new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
    [],
  )

  function categoryProgress(category: ChecklistCategory): { done: number; total: number } {
    const done = category.tasks.filter((task) => {
      if (task.responses.length === 0) return false
      const mine = ownResponse(task, employeeId)
      if (mine?.flaggedNeedsCorrection) return false
      return true
    }).length
    return { done, total: category.tasks.length }
  }

  function applyTaskState(state: TaskResponseStateResponse) {
    setCategories((previous) =>
      previous.map((category) => ({
        ...category,
        tasks: category.tasks.map((task) =>
          task.id === state.taskId
            ? {
                ...task,
                responses: state.responses,
                canUndo: state.canUndo,
                completedByCount: state.completedByCount,
                totalActiveEmployees: state.totalActiveEmployees,
                completedByNames: state.completedByNames,
              }
            : task,
        ),
      })),
    )
  }

  async function submitAnswer(
    task: ChecklistTask,
    value: { booleanValue?: boolean; numericValue?: number; textValue?: string },
  ) {
    if (pendingTaskId != null) return
    setPendingTaskId(task.id)
    setTaskErrors((previous) => ({ ...previous, [task.id]: '' }))
    try {
      const state = await submitTaskResponse(task.id, { storeId: store.id, ...value })
      applyTaskState(state)
      setDrafts((previous) => {
        const next = { ...previous }
        delete next[task.id]
        return next
      })
      localStorage.removeItem(localDraftKey(store.id, task.id, todayDateKey()))
    } catch (err) {
      const message = err instanceof ApiError ? err.message : GENERIC_TASK_ERROR
      setTaskErrors((previous) => ({ ...previous, [task.id]: message }))
      if (err instanceof ApiError && err.status === 409) loadChecklist()
    } finally {
      setPendingTaskId(null)
    }
  }

  async function undoAnswer(task: ChecklistTask) {
    const response = ownResponse(task, employeeId)
    if (!response || undoingTaskId === task.id) return
    setUndoingTaskId(task.id)
    setTaskErrors((previous) => ({ ...previous, [task.id]: '' }))
    setCategories((previous) =>
      previous.map((cat) => ({
        ...cat,
        tasks: cat.tasks.map((t) =>
          t.id === task.id
            ? { ...t, responses: t.responses.filter((r) => r.id !== response.id), canUndo: false }
            : t,
        ),
      })),
    )
    setDrafts((previous) => {
      const next = { ...previous }
      delete next[task.id]
      return next
    })
    localStorage.removeItem(localDraftKey(store.id, task.id, todayDateKey()))
    try {
      const state = await undoTaskResponse(task.id, response.id, store.id)
      applyTaskState(state)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't undo this response. Please try again."
      setTaskErrors((previous) => ({ ...previous, [task.id]: message }))
      loadChecklist()
    } finally {
      setUndoingTaskId(null)
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

  return (
    <div className="employee-dashboard">
      <div className="employee-dashboard-body">
        <div className="employee-dashboard-heading-row">
          <div>
            <h1 className="employee-dashboard-heading">Today's Tasks</h1>
          </div>
          <span className="employee-dashboard-date">
            <span className="icon-mask-calendar" style={{ width: 16, height: 16 }} aria-hidden="true" />
            {todayLabel}
          </span>
        </div>

        <div className="stat-card-row employee-dashboard-summary">
          <StatCard icon={Percent} label="Completion" value={`${completionPercent}%`} tone="primary" />
          <StatCard icon={CheckCircle2} label="Tasks Done" value={completedTasks} tone="success" />
          <StatCard icon={ListTodo} label="Remaining" value={remainingTasks} tone="info" />
          <StatCard icon={Flag} label="Flagged" value={flagCount} tone="warning" />
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

        {!loading && !error && isAllDone && (
          <div className="employee-dashboard__all-done">
            <CheckCircle2 size={48} className="employee-dashboard__all-done-icon" />
            <h2 className="employee-dashboard__all-done-title">All Done for Today</h2>
            <p className="employee-dashboard__all-done-message">
              Every task completed. Good shift{employeeName ? `, ${employeeName.split(' ')[0]}` : ''}!
            </p>
            <p className="employee-dashboard__all-done-stats">
              {completionPercent}% · {completedTasks} task{completedTasks !== 1 ? 's' : ''} completed
            </p>
            <div className="employee-dashboard__all-done-actions">
              <button type="button" className="btn btn--secondary" onClick={() => onNavigate?.('audits')}>
                View History
              </button>
              <button type="button" className="btn btn--danger" onClick={() => onNavigate?.('issues')}>
                Raise an Issue
              </button>
            </div>
          </div>
        )}

        {!loading && !error && categories.length > 0 && !isAllDone && (
          <>
            <CategoryProgressGrid items={stripItems} />

            <div className="filter-bar">
              <div className="filter filter--search">
                <SearchInput value={taskSearch} onChange={setTaskSearch} placeholder="Search tasks…" variant="filter" />
              </div>
              <div className="filter">
                <MultiSelectDropdown
                  options={categories.map((cat) => ({ id: cat.id, label: cat.name }))}
                  selected={categoryFilter}
                  onChange={setCategoryFilter}
                />
              </div>
              <div className="filter">
                <SingleSelectDropdown<'complete' | 'open' | 'needs-correction'>
                  options={[
                    { value: null, label: 'All Status' },
                    { value: 'open', label: 'Open' },
                    { value: 'complete', label: 'Complete' },
                    { value: 'needs-correction', label: 'Needs Correction' },
                  ]}
                  value={statusFilter}
                  onChange={setStatusFilter}
                />
              </div>
            </div>

            {filteredCategories.length === 0 ? (
              <div className="employee-dashboard-empty">
                <ClipboardList size={32} />
                <h2>No tasks match</h2>
                <p>Try adjusting your search or filter.</p>
              </div>
            ) : (
              <div className="checklist-categories">
                {filteredCategories.map((category) => {
                  const progress = categoryProgress(category)
                  const isComplete = progress.total > 0 && progress.done === progress.total
                  return (
                    <details
                      key={category.id}
                      className="checklist-category"
                      open={openCategories.has(category.id)}
                      onToggle={(e) => toggleCategory(category.id, (e.currentTarget as HTMLDetailsElement).open)}
                    >
                      <summary className="checklist-category-summary">
                        <div className="checklist-category-summary-row">
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
                        </div>
                        <div className="checklist-category-bar">
                          <div
                            className={`checklist-category-bar__fill${isComplete ? ' checklist-category-bar__fill--complete' : progress.done > 0 ? ' checklist-category-bar__fill--progress' : ''}`}
                            style={{ width: progress.total === 0 ? '0%' : `${Math.round((progress.done / progress.total) * 100)}%` }}
                          />
                        </div>
                      </summary>

                      <div className="checklist-tasks">
                        {category.tasks.map((task) => {
                          const isPending = pendingTaskId === task.id
                          const mine = ownResponse(task, employeeId)
                          const myResponseIsFlagged = mine?.flaggedNeedsCorrection === true
                          const isSingleLocked = task.completionType === 'SINGLE' && task.responses.length > 0 && !myResponseIsFlagged
                          const isLockedByOther = isSingleLocked && !task.canUndo
                          const controlsDisabled = isPending || isSingleLocked
                          const draft = drafts[task.id]
                          const taskError = taskErrors[task.id]
                          const isMyAnswerDone = mine != null && !myResponseIsFlagged

                          const taskClass = isLockedByOther
                            ? ' checklist-task--locked'
                            : myResponseIsFlagged
                              ? ' checklist-task--flagged'
                              : isMyAnswerDone
                                ? ' checklist-task--done'
                                : ''

                          return (
                            <div key={task.id} className={`checklist-task${taskClass}`}>
                              {/* Task name */}
                              <p className="checklist-task__name">{task.name}</p>

                              {/* Flag reason */}
                              {myResponseIsFlagged && mine?.flagReason && (
                                <div className="checklist-task__flag-box">
                                  <MessageSquareWarning size={13} />
                                  {mine.flagReason}
                                </div>
                              )}

                              {/* Error */}
                              {taskError && <p className="checklist-task__error">{taskError}</p>}

                              {/* Done-by row (when MY answer is done, boolean types) */}
                              {isMyAnswerDone && (task.responseType === 'YES_NO' || task.responseType === 'DONE_NOT_DONE') && (
                                <div className="checklist-task__done-row">
                                  <CheckCircle2 size={14} className="checklist-task__done-icon" />
                                  <span className="checklist-task__done-label">
                                    {task.responseType === 'YES_NO'
                                      ? `Answered ${mine?.booleanValue ? 'Yes' : 'No'}`
                                      : 'Marked as Done'}
                                    {task.completionType === 'MULTIPLE' && task.completedByCount > 1
                                      ? ` · ${task.completedByCount}/${task.totalActiveEmployees} responded`
                                      : ''}
                                  </span>
                                  {task.canUndo && (
                                    <button
                                      type="button"
                                      className="checklist-task__undo"
                                      disabled={undoingTaskId === task.id}
                                      onClick={() => undoAnswer(task)}
                                    >
                                      {undoingTaskId === task.id ? 'Undoing…' : 'Undo'}
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Locked-by-other row */}
                              {isLockedByOther && (
                                <div className="checklist-task__done-row checklist-task__done-row--locked">
                                  <CheckCircle2 size={14} className="checklist-task__done-icon" />
                                  <span className="checklist-task__done-label" title={responderTooltip(task) ?? ''}>
                                    Done by {task.responses[task.responses.length - 1]?.employeeFullName ?? 'another employee'}
                                  </span>
                                </div>
                              )}

                              {/* MULTIPLE completed-by info (when I haven't answered yet) */}
                              {!mine && task.completionType === 'MULTIPLE' && showsCompletedByCount(task) && (
                                <div className="checklist-task__multi-info">
                                  <span>{task.completedByCount}/{task.totalActiveEmployees} responded</span>
                                  <span className="checklist-task-completed-by-info" onMouseEnter={() => setOpenCompletedByTaskId(task.id)} onMouseLeave={() => setOpenCompletedByTaskId((c) => (c === task.id ? null : c))}>
                                    <button
                                      type="button"
                                      className="checklist-task-completed-by-icon"
                                      aria-label={`Who completed ${task.name} today`}
                                      aria-expanded={openCompletedByTaskId === task.id}
                                      onClick={() => setOpenCompletedByTaskId((c) => (c === task.id ? null : task.id))}
                                      onFocus={() => setOpenCompletedByTaskId(task.id)}
                                      onBlur={() => setOpenCompletedByTaskId((c) => (c === task.id ? null : c))}
                                    >
                                      <Info size={13} />
                                    </button>
                                    {openCompletedByTaskId === task.id && (
                                      <div className="checklist-task-completed-by-tooltip" role="tooltip" id={`completed-by-tooltip-${task.id}`}>
                                        {completedByNamesForTooltip(task).map((name) => (
                                          <div key={name} className="checklist-task-completed-by-tooltip-name">{name}</div>
                                        ))}
                                      </div>
                                    )}
                                  </span>
                                </div>
                              )}

                              {/* Answer controls — only when not locked */}
                              {!isLockedByOther && !(isMyAnswerDone && (task.responseType === 'YES_NO' || task.responseType === 'DONE_NOT_DONE')) && (
                                <div className="checklist-task__controls">
                                  {task.responseType === 'YES_NO' && (
                                    <div className="checklist-task__btn-pair">
                                      <button
                                        type="button"
                                        className={`checklist-task-btn checklist-task-btn--no${mine?.booleanValue === false ? ' checklist-task-btn--no-active' : ''}`}
                                        disabled={controlsDisabled}
                                        onClick={() => submitAnswer(task, { booleanValue: false })}
                                      >
                                        No
                                      </button>
                                      <button
                                        type="button"
                                        className={`checklist-task-btn checklist-task-btn--yes${mine?.booleanValue === true ? ' checklist-task-btn--yes-active' : ''}`}
                                        disabled={controlsDisabled}
                                        onClick={() => submitAnswer(task, { booleanValue: true })}
                                      >
                                        Yes
                                      </button>
                                    </div>
                                  )}

                                  {task.responseType === 'DONE_NOT_DONE' && (
                                    <button
                                      type="button"
                                      className={`checklist-task-btn checklist-task-btn--full${mine ? ' checklist-task-btn--yes-active' : ''}`}
                                      disabled={controlsDisabled}
                                      onClick={() => submitAnswer(task, { booleanValue: true })}
                                    >
                                      {mine ? <><CheckCircle2 size={15} /> Marked as Done</> : <><Circle size={15} /> Mark as Done</>}
                                    </button>
                                  )}

                                  {task.responseType === 'TEXT' && (
                                    <div className="checklist-task__input-row">
                                      <input
                                        type="text"
                                        className="input checklist-task__text-input"
                                        disabled={controlsDisabled}
                                        maxLength={task.textMaxLength ?? undefined}
                                        placeholder={task.responseNote ?? 'Enter your response…'}
                                        value={draft ?? mine?.textValue ?? ''}
                                        onChange={(e) => setDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                        onBlur={() => submitTextDraft(task)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                      />
                                      {mine && task.canUndo && (
                                        <button type="button" className="checklist-task__undo" disabled={undoingTaskId === task.id} onClick={() => undoAnswer(task)}>
                                          {undoingTaskId === task.id ? 'Undoing…' : 'Undo'}
                                        </button>
                                      )}
                                    </div>
                                  )}

                                  {task.responseType === 'NUMERIC' && (
                                    <div className="checklist-task__input-row">
                                      <input
                                        type="number"
                                        className="input checklist-task__numeric-input"
                                        disabled={controlsDisabled}
                                        min={task.numericMin ?? undefined}
                                        max={task.numericMax ?? undefined}
                                        value={draft ?? (mine?.numericValue != null ? String(mine.numericValue) : '')}
                                        onChange={(e) => setDrafts((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                        onBlur={() => submitNumericDraft(task)}
                                        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
                                      />
                                      {task.numericUnit && <span className="checklist-task__unit">{task.numericUnit}</span>}
                                      {mine && task.canUndo && (
                                        <button type="button" className="checklist-task__undo" disabled={undoingTaskId === task.id} onClick={() => undoAnswer(task)}>
                                          {undoingTaskId === task.id ? 'Undoing…' : 'Undo'}
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
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
          </>
        )}
      </div>
    </div>
  )
}

export default EmployeeDashboard
