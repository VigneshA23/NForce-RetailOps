import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Blend, CheckCircle2, ChevronDown, Clock, Lock, ShieldCheck, Sparkles, Store as StoreIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { getShiftHistory } from '../api/history'
import type { StoreSummary } from '../types/store'
import type { AuditStatus, ShiftHistory, TaskStatus } from '../types/history'
import Modal from '../components/Modal'
import StatCard from '../components/StatCard'
import './EmployeeHistory.css'

interface EmployeeHistoryProps {
  store: StoreSummary
  // The same server-scoped list the shell was given, so history can only ever
  // be viewed for a store the employee is assigned to.
  stores: StoreSummary[]
}

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  preparation: Blend,
  cleaning: Sparkles,
  closing: Lock,
}

const AUDIT_LABEL: Record<AuditStatus, string> = {
  AUDITED: 'Audited',
  PENDING_AUDIT: 'Pending Audit',
  NOT_AUDITED: 'Not Audited',
}

const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  YES: 'Completed',
  NO: 'Not completed',
  NOT_ANSWERED: 'Not answered',
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10)
}

function formatDateLabel(date: string): string {
  const parsed = new Date(`${date}T00:00:00`)
  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function EmployeeHistory({ store, stores }: EmployeeHistoryProps) {
  const availableStores = stores.length > 0 ? stores : [store]
  const [selectedStoreId, setSelectedStoreId] = useState(store.id)
  const [selectedDate, setSelectedDate] = useState(todayDate)
  const [history, setHistory] = useState<ShiftHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [isReportOpen, setIsReportOpen] = useState(false)

  useEffect(() => {
    let active = true
    setLoading(true)
    getShiftHistory(selectedStoreId, selectedDate).then((result) => {
      if (active) {
        setHistory(result)
        setLoading(false)
      }
    })
    return () => {
      active = false
    }
  }, [selectedStoreId, selectedDate])

  const selectedStore = useMemo(
    () => availableStores.find((candidate) => candidate.id === selectedStoreId) ?? store,
    [availableStores, selectedStoreId, store],
  )

  const summary = history?.summary

  const progressStyle = useMemo(() => {
    const percent = summary?.onTimePercent ?? 0
    return {
      background: `conic-gradient(var(--color-accent) ${percent}%, var(--color-border) ${percent}% 100%)`,
    }
  }, [summary])

  return (
    <div className="employee-history">
      <div className="employee-history-header">
        <div>
          <h1 className="employee-history-heading">Operational History</h1>
          <p className="employee-history-subheading">Review past shifts, completed tasks, and audit logs.</p>
        </div>
        <div className="employee-history-filters">
          <label className="employee-history-filter-select">
            <StoreIcon size={16} />
            <select value={selectedStoreId} onChange={(event) => setSelectedStoreId(Number(event.target.value))}>
              {availableStores.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="employee-history-filter-chevron" />
          </label>
          <span className="employee-history-filter-divider" aria-hidden="true" />
          <label className="employee-history-filter-date">
            <Clock size={16} />
            <input
              type="date"
              value={selectedDate}
              max={todayDate()}
              onChange={(event) => setSelectedDate(event.target.value || todayDate())}
            />
            <span>{formatDateLabel(selectedDate)}</span>
          </label>
        </div>
      </div>

      {loading && <p className="employee-history-loading">Loading history…</p>}

      {!loading && history && (
        <div className="employee-history-grid">
          <div className="employee-history-timeline">
            {history.categories.map((category, index) => {
              const Icon = CATEGORY_ICONS[category.id] ?? Clock
              const isComplete = category.tasksTotal > 0 && category.tasksCompleted === category.tasksTotal
              const isLast = index === history.categories.length - 1
              return (
                <div key={category.id} className="employee-history-timeline-item">
                  {!isLast && <span className="employee-history-timeline-line" aria-hidden="true" />}
                  <span className={`employee-history-timeline-dot${isComplete ? ' employee-history-timeline-dot--complete' : ''}`}>
                    <Icon size={16} />
                  </span>
                  <div className={`employee-history-card${isComplete ? ' employee-history-card--highlight' : ''}`}>
                    <div className="employee-history-card-header">
                      <div>
                        <h3>{category.name}</h3>
                        <p className="employee-history-card-time">
                          <Clock size={14} />
                          {category.completedAt
                            ? `Completed at ${category.completedAt}`
                            : category.scheduledFor
                              ? `Scheduled for ${category.scheduledFor}`
                              : 'Not started'}
                        </p>
                      </div>
                      {category.completedAt && (
                        <span className={`employee-history-audit-badge employee-history-audit-badge--${category.auditStatus.toLowerCase()}`}>
                          {AUDIT_LABEL[category.auditStatus]}
                        </span>
                      )}
                    </div>

                    {category.completedAt && (
                      <div className="employee-history-card-footer">
                        <div className="employee-history-staff">
                          {category.staff.length === 0 ? (
                            <span className="employee-history-staff-empty">No staff recorded</span>
                          ) : (
                            category.staff.map((member) => (
                              <span key={member.id} className="employee-history-staff-avatar" title={member.name}>
                                {member.initials}
                              </span>
                            ))
                          )}
                        </div>
                        <div className="employee-history-card-count">
                          <span className="employee-history-card-count-value">
                            {category.tasksCompleted}/{category.tasksTotal}
                          </span>
                          <span className="employee-history-card-count-label">Tasks Completed</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="employee-history-summary">
            <h3>Daily Summary</h3>
            <div className="employee-history-progress-ring" style={progressStyle}>
              <div className="employee-history-progress-ring-inner">
                <span className="employee-history-progress-value">{summary?.onTimePercent ?? 0}%</span>
                <span className="employee-history-progress-label">On Time</span>
              </div>
            </div>
            <div className="employee-history-stats">
              <StatCard icon={CheckCircle2} label="Total Tasks" value={summary?.totalTasks ?? 0} tone="primary" />
              <StatCard icon={ShieldCheck} label="Audits" value={summary?.audits ?? 0} tone="info" />
            </div>
            <button type="button" className="employee-history-report-btn" onClick={() => setIsReportOpen(true)}>
              View Full Report
              <ArrowRight size={16} />
            </button>
          </div>
        </div>
      )}

      <Modal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={`Full Report — ${formatDateLabel(selectedDate)}`}
        footer={
          <button type="button" className="btn btn--secondary" onClick={() => setIsReportOpen(false)}>
            Close
          </button>
        }
      >
        <div className="employee-history-report">
          <p className="employee-history-report-subtitle">{selectedStore.name}</p>
          {history?.categories.map((category) => (
            <div key={category.id} className="employee-history-report-category">
              <div className="employee-history-report-category-header">
                <h4>{category.name}</h4>
                <span className={`employee-history-audit-badge employee-history-audit-badge--${category.auditStatus.toLowerCase()}`}>
                  {AUDIT_LABEL[category.auditStatus]}
                </span>
              </div>

              {category.auditStatus === 'AUDITED' && (
                <p className="employee-history-report-audit-note">
                  Audited by <strong>{category.auditedBy}</strong>
                  {category.auditNote ? ` — ${category.auditNote}` : ''}
                </p>
              )}

              <div className="employee-history-report-tasks">
                {category.tasks.map((task) => (
                  <div key={task.id} className="employee-history-report-task">
                    <div>
                      <p className="employee-history-report-task-name">{task.name}</p>
                      <p className={`employee-history-report-task-status employee-history-report-task-status--${task.status.toLowerCase()}`}>
                        {TASK_STATUS_LABEL[task.status]}
                        {task.completedAt ? ` at ${task.completedAt}` : ''}
                      </p>
                    </div>
                    {task.completedBy && (
                      <div className="employee-history-report-task-staff">
                        <span className="employee-history-staff-avatar">{task.completedBy.initials}</span>
                        <span>{task.completedBy.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}

export default EmployeeHistory
