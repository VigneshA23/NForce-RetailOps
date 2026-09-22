import type { CompletionType, TaskResponseType } from './task'

// Server-computed row state -- the frontend never derives this itself, it just
// renders it. Mirrors MissedTaskInstanceResponse.state on the backend.
export type MissedTaskState = 'ACTIONABLE' | 'LINKED' | 'WAITING_ON_SECOND'

export interface MissedTaskInstance {
  taskId: number
  taskName: string
  description: string | null
  responseType: TaskResponseType
  responseNote: string | null
  numericUnit: string | null
  numericMin: number | null
  numericMax: number | null
  textMaxLength: number | null
  completionType: CompletionType
  date: string
  state: MissedTaskState
  completedByCount: number
  totalActiveEmployees: number
  canCompleteWithToday: boolean
  canUnlink: boolean
  linkedDate: string | null
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

export interface MissedTaskLink {
  taskId: number
  pastDate: string
  linkedDate: string
  status: string
}
