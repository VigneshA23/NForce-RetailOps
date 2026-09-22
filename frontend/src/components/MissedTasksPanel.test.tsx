import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import MissedTasksPanel from './MissedTasksPanel'
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
    description: null,
    responseType: 'YES_NO',
    responseNote: null,
    numericUnit: null,
    numericMin: null,
    numericMax: null,
    textMaxLength: null,
    completionType: 'SINGLE',
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

describe('MissedTasksPanel', () => {
  it('renders nothing when there is nothing missed', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([]))
    const { container } = render(<MissedTasksPanel store={STORE} />)

    // Wait for the load to settle, then assert the whole panel stayed absent.
    await vi.waitFor(() => expect(mockGetMissedTasks).toHaveBeenCalled())
    await vi.waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('auto-opens and shows the count when something is missed', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    render(<MissedTasksPanel store={STORE} />)

    expect(await screen.findByRole('button', { name: /missed tasks/i })).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Sweep the floor')).toBeInTheDocument()
  })

  it('collapses and re-expands via the toggle header', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    const user = userEvent.setup()
    render(<MissedTasksPanel store={STORE} />)

    const toggle = await screen.findByRole('button', { name: /missed tasks/i })
    expect(screen.getByText('Sweep the floor')).toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Sweep the floor')).not.toBeInTheDocument()

    await user.click(toggle)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Sweep the floor')).toBeInTheDocument()
  })

  it('completes an ACTIONABLE Yes/No instance via Complete Now and removes it from the list', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({})]))
    mockCompleteMissedTaskNow.mockResolvedValue({
      taskId: 1, responses: [], canUndo: false, completedByCount: 1, totalActiveEmployees: 2, completedByNames: [],
    })
    const user = userEvent.setup()
    render(<MissedTasksPanel store={STORE} />)

    const yesButton = await screen.findByRole('button', { name: 'Yes' })
    await user.click(yesButton)

    expect(mockCompleteMissedTaskNow).toHaveBeenCalledWith(1, '2026-09-20', { storeId: 1, booleanValue: true })
    expect(screen.queryByText('Sweep the floor')).not.toBeInTheDocument()
    // The section stays visible (with a success message) instead of vanishing
    // mid-interaction, even though the live count just dropped to 0.
    expect(await screen.findByText(/nothing missed/i)).toBeInTheDocument()
  })

  it('shows "Waiting on second person" with no action buttons for that state', async () => {
    mockGetMissedTasks.mockResolvedValue(
      pageWith([instance({ state: 'WAITING_ON_SECOND', completionType: 'MULTIPLE', completedByCount: 1 })]),
    )
    render(<MissedTasksPanel store={STORE} />)

    expect(await screen.findByText(/waiting on second person/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })

  it('shows a "Linked to today" badge and lets the creator unlink it', async () => {
    mockGetMissedTasks.mockResolvedValue(
      pageWith([instance({ state: 'LINKED', canUnlink: true, linkedDate: '2026-09-22' })]),
    )
    mockUnlinkMissedTask.mockResolvedValue(undefined)
    const user = userEvent.setup()
    render(<MissedTasksPanel store={STORE} />)

    expect(await screen.findByText(/linked to today/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /unlink/i }))

    expect(mockUnlinkMissedTask).toHaveBeenCalledWith(1, '2026-09-20', 1)
  })

  it('shows "Complete with Today" when eligible and links it to today on click', async () => {
    mockGetMissedTasks.mockResolvedValue(pageWith([instance({ canCompleteWithToday: true })]))
    mockLinkMissedTaskToToday.mockResolvedValue({ taskId: 1, pastDate: '2026-09-20', linkedDate: '2026-09-22', status: 'PENDING' })
    const user = userEvent.setup()
    render(<MissedTasksPanel store={STORE} />)

    const linkButton = await screen.findByRole('button', { name: /complete with today/i })
    await user.click(linkButton)

    expect(mockLinkMissedTaskToToday).toHaveBeenCalledWith(1, '2026-09-20', 1)
    expect(await screen.findByText(/linked to today/i)).toBeInTheDocument()
  })
})
