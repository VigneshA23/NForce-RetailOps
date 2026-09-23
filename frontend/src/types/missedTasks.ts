import type { CompletionType, TaskResponseType } from './task'
import type { DayCode, ScheduleType } from './adminTask'

// Server-computed row state -- the frontend never derives this itself, it just
// renders it. Mirrors MissedTaskInstanceResponse.state on the backend. An
// instance with a pending move is excluded from the list entirely rather than
// surfaced with a "linked" state (see TaskMakeupLinkService.getMissedTasks).
export type MissedTaskState = 'ACTIONABLE' | 'WAITING_ON_SECOND'

export interface MissedTaskInstance {
  taskId: number
  taskName: string
  categoryName: string
  description: string | null
  responseType: TaskResponseType
  responseNote: string | null
  numericUnit: string | null
  numericMin: number | null
  numericMax: number | null
  textMaxLength: number | null
  completionType: CompletionType
  // Mirrors AdminTask's own scheduleType/selectedDays/startDate/endDate so the
  // tile can reuse scheduleSummary() (utils/adminTaskOptions) for its "Every
  // day" / "Weekdays" / "Once on ..." subtitle, same wording as Admin's task
  // table.
  scheduleType: ScheduleType
  selectedDays: DayCode[]
  taskStartDate: string
  taskEndDate: string | null
  date: string
  state: MissedTaskState
  completedByCount: number
  totalActiveEmployees: number
}

export interface MissedTaskDateGroup {
  date: string
  instances: MissedTaskInstance[]
}

export interface MissedTasksPage {
  groups: MissedTaskDateGroup[]
  nextCursor: string | null
  // Full missed-instance count across every page, not just this one -- the Home
  // page's "Missed Tasks (n)" stat tile reads this off page one.
  totalInstances: number
}

// A move's server-returned state right after creating it (POST .../move) --
// mirrors MissedTaskMoveResponse on the backend.
export interface MissedTaskMove {
  taskId: number
  originalDueDate: string
  targetDate: string
  status: string
}
