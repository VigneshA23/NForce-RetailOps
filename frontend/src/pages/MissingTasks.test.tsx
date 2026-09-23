import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MissingTasks from './MissingTasks'
import * as missedTasksApi from '../api/missedTasks'
import type { MissedTaskInstance, MissedTasksPage } from '../types/missedTasks'
import type { StoreSummary } from '../types/store'

vi.mock('../api/missedTasks', () => ({
  getMissedTasks: vi.fn(),
  completeMissedTaskNow: vi.fn(),
  linkMissedTaskToToday: vi.fn(),
  unlinkMissedTask: vi.fn(),
}))

const mockGetMissedTasks = vi.mocked(missedTasksApi.getMissedTasks)
const mockCompleteMissedTaskNow = vi.mocked(missedTasksApi.completeMissedTaskNow)
const mockLinkMissedTaskToToday = vi.mocked(missedTasksApi.linkMissedTaskToToday)
const mockUnlinkMissedTask = vi.mocked(missedTasksApi.unlinkMissedTask)

const STORE: StoreSummary = { id: 1, name: 'Store 1', location: 'Main St', status: 'Open' }

function instance(overrides: Partial<MissedTaskInstance>): MissedTaskInstance {
  return {
    taskId: 1,
    taskName: 'Sweep the floor',
    categoryName: 'Closing Checks',
    description: null,
    responseType: 'YES_NO',
    responseNote: null,
    numericUnit: null,
    numericMin: null,
    numericMax: null,
    textMaxLength: null,
    completionType: 'SINGLE',
    scheduleType: 'EVERY_DAY',
    selectedDays: [],
    taskStartDate: '2026-01-01',
    taskEndDate: null,
    date: '2026-09-20',
    state: 'ACTIONABLE',
    completedByCount: 0,
    totalActiveEmployees: 2,
    canCompleteWithToday: false,
    canUnlink: false,
    linkedDate: null,
    ...overrides,
  }
}

function pageWith(instances: MissedTaskInstance[]): MissedTasksPage {
  const byDate = new Map<string, MissedTaskInstance[]>()
  for (const item of instances) {
    byDate.set(item.date, [...(byDate.get(item.date) ?? []), item])
  }
  return {
    groups: [...byDate.entries()].map(([date, items]) => ({ date, instances: items })),
    nextCursor: null,
    totalInstances: instances.length,
  }
}

beforeEach(() => {
  mockGetMissedTasks.mockReset()
  mockCompleteMissedTaskNow.mockReset()
  mockLinkMissedTaskToToday.mockReset()
  mockUnlinkMissedTask.mockReset()
})

describe('MissingTasks page', () => {
  it('shows the empty state when nothing is missing', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([]))
    render(<MissingTasks store={STORE} />)

    expect(await screen.findByText(/nothing missing/i)).toBeInTheDocument()
  })

  it('lists missing tasks grouped by date', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    render(<MissingTasks store={STORE} />)

    expect(await screen.findByText('Sweep the floor')).toBeInTheDocument()
  })

  it('stages a Yes/No answer and only submits it once Complete is clicked', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    mockCompleteMissedTaskNow.mockResolvedValue({
      taskId: 1, responses: [], canUndo: false, completedByCount: 1, totalActiveEmployees: 2, completedByNames: [],
    })
    const onCompleted = vi.fn()
    const user = userEvent.setup()
    render(<MissingTasks store={STORE} onCompleted={onCompleted} />)

    const yesButton = await screen.findByRole('button', { name: 'Yes' })
    await user.click(yesButton)

    // Selecting Yes only stages it -- nothing is submitted yet.
    expect(mockCompleteMissedTaskNow).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Complete' }))

    expect(mockCompleteMissedTaskNow).toHaveBeenCalledWith(1, '2026-09-20', { storeId: 1, booleanValue: true })
    expect(screen.queryByText('Sweep the floor')).not.toBeInTheDocument()
    expect(onCompleted).toHaveBeenCalled()
  })

  it('does nothing when Complete is clicked for a Yes/No task with no selection yet', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    const user = userEvent.setup()
    render(<MissingTasks store={STORE} />)

    await user.click(await screen.findByRole('button', { name: 'Complete' }))

    expect(mockCompleteMissedTaskNow).not.toHaveBeenCalled()
    expect(screen.getByText('Sweep the floor')).toBeInTheDocument()
  })

  it('shows "Waiting on second person" with no action buttons for that state', async () => {
    mockGetMissedTasks.mockResolvedValue(
      pageWith([instance({ state: 'WAITING_ON_SECOND', completionType: 'MULTIPLE', completedByCount: 1 })]),
    )
    render(<MissingTasks store={STORE} />)

    expect(await screen.findByText(/waiting on second person/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })

  it('shows a "Linked to today" badge and lets the creator unlink it', async () => {
    mockGetMissedTasks.mockResolvedValue(
      pageWith([instance({ state: 'LINKED', canUnlink: true, linkedDate: '2026-09-22' })]),
    )
    mockUnlinkMissedTask.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MissingTasks store={STORE} />)

    expect(await screen.findByText(/linked to today/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /cancel link/i }))

    expect(mockUnlinkMissedTask).toHaveBeenCalledWith(1, '2026-09-20', 1)
  })

  it('shows "Complete with Today" when eligible, with its explanatory hint, and links it to today on click', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({ canCompleteWithToday: true })]))
    mockLinkMissedTaskToToday.mockResolvedValue({ taskId: 1, pastDate: '2026-09-20', linkedDate: '2026-09-22', status: 'PENDING' })
    const user = userEvent.setup()
    render(<MissingTasks store={STORE} />)

    const linkButton = await screen.findByRole('button', { name: /complete with today/i })
    expect(screen.getByText(/marked complete too/i)).toBeInTheDocument()
    await user.click(linkButton)

    expect(mockLinkMissedTaskToToday).toHaveBeenCalledWith(1, '2026-09-20', 1)
    expect(await screen.findByText(/linked to today/i)).toBeInTheDocument()
  })

  it('sorts within a date: complete-with-today first, then other actionable, then linked, then waiting -- response type as the tiebreaker', async () => {
    // Deliberately out of the expected order, to prove the component sorts
    // rather than just preserving whatever order the API returned.
    mockGetMissedTasks.mockResolvedValue(pageWith([
      instance({ taskId: 1, taskName: 'Text task A', responseType: 'TEXT', canCompleteWithToday: false }),
      instance({ taskId: 2, taskName: 'Waiting task', responseType: 'YES_NO', state: 'WAITING_ON_SECOND', completionType: 'MULTIPLE', completedByCount: 1 }),
      instance({ taskId: 3, taskName: 'Numeric with today', responseType: 'NUMERIC', canCompleteWithToday: true }),
      instance({ taskId: 4, taskName: 'Linked task', responseType: 'YES_NO', state: 'LINKED', canUnlink: true }),
      instance({ taskId: 5, taskName: 'Done actionable', responseType: 'DONE_NOT_DONE', canCompleteWithToday: false }),
      instance({ taskId: 6, taskName: 'Yes/No with today', responseType: 'YES_NO', canCompleteWithToday: true }),
    ]))
    const { container } = render(<MissingTasks store={STORE} />)

    await screen.findByText('Yes/No with today')
    const names = [...container.querySelectorAll('.missing-task-row__name')].map((el) => el.textContent)

    expect(names).toEqual([
      'Yes/No with today',
      'Numeric with today',
      'Done actionable',
      'Text task A',
      'Linked task',
      'Waiting task',
    ])
  })

  it('shows the responded count as its own line, not next to the task name', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([
      instance({ completionType: 'MULTIPLE', completedByCount: 1, totalActiveEmployees: 4 }),
    ]))
    render(<MissingTasks store={STORE} />)

    const name = await screen.findByText('Sweep the floor')
    const multiLine = await screen.findByText('1/4 responded')

    // Same info block, but a separate element from the name -- not combined
    // into one line the way the title-line badge used to be.
    expect(multiLine.closest('.missing-task-row__info')).toBe(name.closest('.missing-task-row__info'))
    expect(multiLine).not.toBe(name)
    expect(name.textContent).not.toContain('responded')
  })
})
