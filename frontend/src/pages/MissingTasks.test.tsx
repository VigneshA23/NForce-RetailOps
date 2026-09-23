import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MissingTasks from './MissingTasks'
import * as missedTasksApi from '../api/missedTasks'
import type { MissedTaskInstance, MissedTasksPage } from '../types/missedTasks'
import type { StoreSummary } from '../types/store'

vi.mock('../api/missedTasks', () => ({
  getMissedTasks: vi.fn(),
  moveMissedTask: vi.fn(),
}))

const mockGetMissedTasks = vi.mocked(missedTasksApi.getMissedTasks)
const mockMoveMissedTask = vi.mocked(missedTasksApi.moveMissedTask)

const STORE: StoreSummary = { id: 1, name: 'Store 1', location: 'Main St', status: 'Open' }

function todayKey(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

// Mirrors the component's own formatDate() -- locale-dependent (e.g. "Sep 20"
// vs "20 Sept" depending on the environment), so tests must compute the exact
// expected label the same way rather than guessing a fixed word order.
function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

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
  mockMoveMissedTask.mockReset()
})

describe('MissingTasks page', () => {
  it('shows the empty state when nothing is missed', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([]))
    render(<MissingTasks store={STORE} />)

    expect(await screen.findByText(/nothing missed/i)).toBeInTheDocument()
  })

  it('lists missed tasks grouped by date', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    render(<MissingTasks store={STORE} />)

    expect(await screen.findByText('Sweep the floor')).toBeInTheDocument()
  })

  it('shows exactly one Move button per actionable row, opens a calendar, and moving removes the row', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    mockMoveMissedTask.mockResolvedValue({ taskId: 1, originalDueDate: '2026-09-20', targetDate: todayKey(), status: 'PENDING' })
    const onMoved = vi.fn()
    const user = userEvent.setup()
    render(<MissingTasks store={STORE} onMoved={onMoved} />)

    const moveButtons = await screen.findAllByRole('button', { name: /move/i })
    expect(moveButtons).toHaveLength(1)
    await user.click(moveButtons[0])

    const dialog = await screen.findByRole('dialog', { name: /choose a date/i })
    const todayCell = within(dialog).getByRole('button', { name: String(new Date().getDate()) })
    await user.click(todayCell)

    expect(mockMoveMissedTask).toHaveBeenCalledWith(1, '2026-09-20', 1, todayKey())
    expect(screen.queryByText('Sweep the floor')).not.toBeInTheDocument()
    expect(onMoved).toHaveBeenCalled()
  })

  it('keeps the row and shows an error when the move fails', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    mockMoveMissedTask.mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    render(<MissingTasks store={STORE} />)

    await user.click(await screen.findByRole('button', { name: /move/i }))
    const dialog = await screen.findByRole('dialog', { name: /choose a date/i })
    await user.click(within(dialog).getByRole('button', { name: String(new Date().getDate()) }))

    expect(await screen.findByText(/couldn't move this task/i)).toBeInTheDocument()
    expect(screen.getByText('Sweep the floor')).toBeInTheDocument()
  })

  it('shows "Waiting on 2nd" status with no Move button for that state', async () => {
    mockGetMissedTasks.mockResolvedValue(
      pageWith([instance({ state: 'WAITING_ON_SECOND', completionType: 'MULTIPLE', completedByCount: 1 })]),
    )
    render(<MissingTasks store={STORE} />)

    expect(await screen.findByText(/waiting on 2nd/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /move/i })).not.toBeInTheDocument()
  })

  it('sorts within a date: actionable first, then waiting -- response type as the tiebreaker', async () => {
    // Deliberately out of the expected order, to prove the component sorts
    // rather than just preserving whatever order the API returned.
    mockGetMissedTasks.mockResolvedValue(pageWith([
      instance({ taskId: 1, taskName: 'Text task A', responseType: 'TEXT' }),
      instance({ taskId: 2, taskName: 'Waiting task', responseType: 'YES_NO', state: 'WAITING_ON_SECOND', completionType: 'MULTIPLE', completedByCount: 1 }),
      instance({ taskId: 3, taskName: 'Numeric task', responseType: 'NUMERIC' }),
      instance({ taskId: 5, taskName: 'Done actionable', responseType: 'DONE_NOT_DONE' }),
      instance({ taskId: 6, taskName: 'Yes/No task', responseType: 'YES_NO' }),
    ]))
    const { container } = render(<MissingTasks store={STORE} />)

    await screen.findByText('Yes/No task')
    const names = [...container.querySelectorAll('.missing-tasks-table__task-name')].map((el) => el.textContent)

    expect(names).toEqual([
      'Yes/No task',
      'Done actionable',
      'Numeric task',
      'Text task A',
      'Waiting task',
    ])
  })

  it('shows the responded count under the task name, as its own line', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([
      instance({ completionType: 'MULTIPLE', completedByCount: 1, totalActiveEmployees: 4 }),
    ]))
    render(<MissingTasks store={STORE} />)

    const name = await screen.findByText('Sweep the floor')
    const respondedLine = await screen.findByText('1/4 responded')

    expect(respondedLine.closest('tr')).toBe(name.closest('tr'))
    expect(respondedLine).not.toBe(name)
    expect(name.textContent).not.toContain('responded')
  })

  it('has no separate Response or Status columns', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    render(<MissingTasks store={STORE} />)

    await screen.findByText('Sweep the floor')
    expect(screen.queryByRole('columnheader', { name: /^response$/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('columnheader', { name: /^status$/i })).not.toBeInTheDocument()
  })

  it('renders Category and Date Missed columns for a row', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({ categoryName: 'Cleaning & Hygiene', date: '2026-09-20' })]))
    render(<MissingTasks store={STORE} />)

    const name = await screen.findByText('Sweep the floor')
    const row = name.closest('tr')
    expect(row).not.toBeNull()
    expect(within(row!).getByText('Cleaning & Hygiene')).toBeInTheDocument()
    expect(within(row!).getByText(formatDate('2026-09-20'), { exact: false })).toBeInTheDocument()
  })

  it('filters by the search box, matching task name or category name', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([
      instance({ taskId: 1, taskName: 'Sweep A', categoryName: 'Closing Checks' }),
      instance({ taskId: 2, taskName: 'Mop B', categoryName: 'Opening Checks' }),
    ]))
    const user = userEvent.setup()
    render(<MissingTasks store={STORE} />)

    await screen.findByText('Sweep A')
    await user.type(screen.getByPlaceholderText(/search tasks/i), 'sweep')

    expect(screen.getByText('Sweep A')).toBeInTheDocument()
    expect(screen.queryByText('Mop B')).not.toBeInTheDocument()

    await user.clear(screen.getByPlaceholderText(/search tasks/i))
    await user.type(screen.getByPlaceholderText(/search tasks/i), 'opening')

    expect(screen.queryByText('Sweep A')).not.toBeInTheDocument()
    expect(screen.getByText('Mop B')).toBeInTheDocument()
  })

  it('filters by date and by category using the two filter dropdowns', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([
      instance({ taskId: 1, taskName: 'Sweep A', categoryName: 'Closing Checks', date: '2026-09-20' }),
      instance({ taskId: 2, taskName: 'Mop B', categoryName: 'Opening Checks', date: '2026-09-21' }),
    ]))
    const user = userEvent.setup()
    render(<MissingTasks store={STORE} />)

    await screen.findByText('Sweep A')
    expect(screen.getByText('Mop B')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /filter missed tasks by category/i }))
    await user.click(await screen.findByRole('option', { name: 'Opening Checks' }))

    expect(screen.queryByText('Sweep A')).not.toBeInTheDocument()
    expect(screen.getByText('Mop B')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /filter missed tasks by category/i }))
    await user.click(await screen.findByRole('option', { name: 'All categories' }))
    await screen.findByText('Sweep A')

    await user.click(screen.getByRole('button', { name: /filter missed tasks by date/i }))
    await user.click(await screen.findByRole('option', { name: formatDate('2026-09-20') }))

    expect(screen.getByText('Sweep A')).toBeInTheDocument()
    expect(screen.queryByText('Mop B')).not.toBeInTheDocument()
  })

  it('renders a Back button that calls onBack, and omits it when onBack is not provided', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([]))
    const onBack = vi.fn()
    const user = userEvent.setup()
    const { rerender } = render(<MissingTasks store={STORE} onBack={onBack} />)

    await user.click(await screen.findByRole('button', { name: /back/i }))
    expect(onBack).toHaveBeenCalled()

    rerender(<MissingTasks store={STORE} />)
    expect(screen.queryByRole('button', { name: /back/i })).not.toBeInTheDocument()
  })
})
