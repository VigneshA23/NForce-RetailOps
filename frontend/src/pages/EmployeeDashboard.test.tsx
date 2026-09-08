import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployeeDashboard from './EmployeeDashboard'
import * as tasksApi from '../api/tasks'
import type { ChecklistCategory } from '../types/task'
import type { StoreSummary } from '../types/store'

vi.mock('../api/tasks', () => ({
  getDailyChecklist: vi.fn(),
  raiseIssue: vi.fn(),
  submitTaskResponse: vi.fn(),
  undoTaskResponse: vi.fn(),
}))

const mockGetDailyChecklist = vi.mocked(tasksApi.getDailyChecklist)
const mockSubmitTaskResponse = vi.mocked(tasksApi.submitTaskResponse)

const STORE: StoreSummary = { id: 1, name: 'Store 1', location: 'Main St', status: 'Open' }

function checklistWith(task: ChecklistCategory['tasks'][number]): ChecklistCategory[] {
  return [{ id: 1, name: 'Category', tasks: [task] }]
}

beforeEach(() => {
  mockGetDailyChecklist.mockReset()
  mockSubmitTaskResponse.mockReset()
})

describe('Employee Checklist response type rendering', () => {
  it('renders Yes/No controls for a Yes/No task', async () => {
    mockGetDailyChecklist.mockResolvedValue(
      checklistWith({
        id: 1,
        name: 'Prepare Station',
        description: null,
        responseType: 'YES_NO',
        responseNote: null,
        numericUnit: null,
        numericMin: null,
        numericMax: null,
        textMaxLength: null,
        completionType: 'SINGLE',
        maxCompletions: null,
        responses: [],
        canUndo: false,
        completedByCount: 0,
        totalActiveEmployees: 3,
        completedByNames: [],
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
    // SINGLE tasks never show the X/Y Completed By count, regardless of headcount.
    expect(screen.queryByText(/Completed By/)).not.toBeInTheDocument()
  })

  it('renders a Done control (not Yes/No) for a Done/Checkbox task', async () => {
    mockGetDailyChecklist.mockResolvedValue(
      checklistWith({
        id: 2,
        name: 'Prepare Waffle Cones',
        description: null,
        responseType: 'DONE_NOT_DONE',
        responseNote: null,
        numericUnit: null,
        numericMin: null,
        numericMax: null,
        textMaxLength: null,
        completionType: 'SINGLE',
        maxCompletions: null,
        responses: [],
        canUndo: false,
        completedByCount: 0,
        totalActiveEmployees: 1,
        completedByNames: [],
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByRole('button', { name: /done/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'No' })).not.toBeInTheDocument()
  })

  it('renders a text input, respecting Maximum Character Limit, for a Short Text task', async () => {
    mockGetDailyChecklist.mockResolvedValue(
      checklistWith({
        id: 3,
        name: 'Note the temperature check',
        description: null,
        responseType: 'TEXT',
        responseNote: null,
        numericUnit: null,
        numericMin: null,
        numericMax: null,
        textMaxLength: 25,
        completionType: 'SINGLE',
        maxCompletions: null,
        responses: [],
        canUndo: false,
        completedByCount: 0,
        totalActiveEmployees: 1,
        completedByNames: [],
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    const input = await screen.findByRole('textbox')
    expect(input).toHaveAttribute('maxlength', '25')
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })

  it('renders a numeric input honoring Min/Max and displays the Unit for a Number task', async () => {
    mockGetDailyChecklist.mockResolvedValue(
      checklistWith({
        id: 4,
        name: 'Log Freezer Temp',
        description: null,
        responseType: 'NUMERIC',
        responseNote: null,
        numericUnit: '°F',
        numericMin: 32,
        numericMax: 40,
        textMaxLength: null,
        completionType: 'SINGLE',
        maxCompletions: null,
        responses: [],
        canUndo: false,
        completedByCount: 0,
        totalActiveEmployees: 1,
        completedByNames: [],
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    const input = await screen.findByRole('spinbutton')
    expect(input).toHaveAttribute('min', '32')
    expect(input).toHaveAttribute('max', '40')
    expect(screen.getByText('°F')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Yes' })).not.toBeInTheDocument()
  })

  it('submits the entered value with the correct response type when completing a Short Text task', async () => {
    const task: ChecklistCategory['tasks'][number] = {
      id: 5,
      name: 'Log an issue',
      description: null,
      responseType: 'TEXT',
      responseNote: null,
      numericUnit: null,
      numericMin: null,
      numericMax: null,
      textMaxLength: 25,
      completionType: 'SINGLE',
      maxCompletions: null,
      responses: [],
      canUndo: false,
      completedByCount: 0,
      totalActiveEmployees: 1,
      completedByNames: [],
    }
    mockGetDailyChecklist.mockResolvedValue([{
      id: 1,
      name: 'Category',
      tasks: [task, progressTask({ id: 98, name: 'Pending task', responseType: 'YES_NO' })],
    }])
    mockSubmitTaskResponse.mockResolvedValue({
      taskId: 5,
      canUndo: true,
      responses: [
        {
          id: 1,
          employeeUserId: 99,
          employeeFullName: 'Test Employee',
          booleanValue: null,
          numericValue: null,
          textValue: 'All clear',
          respondedAt: new Date().toISOString(),
          flaggedNeedsCorrection: false,
          flagReason: null,
        },
      ],
      completedByCount: 1,
      totalActiveEmployees: 1,
      completedByNames: ['Test Employee'],
    })

    const user = userEvent.setup()
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    const input = await screen.findByRole('textbox')
    await user.type(input, 'All clear')
    await user.tab()

    expect(mockSubmitTaskResponse).toHaveBeenCalledWith(5, { storeId: 1, textValue: 'All clear' })
    expect(await screen.findByText('Completed by Test Employee')).toBeInTheDocument()
  })
})

describe('Employee Checklist "X/Y Completed By" display', () => {
  it('shows "Not Answered" and no X/Y count for a MULTIPLE task with zero active responses', async () => {
    mockGetDailyChecklist.mockResolvedValue(
      checklistWith({
        id: 6,
        name: 'Restock napkins',
        description: null,
        responseType: 'DONE_NOT_DONE',
        responseNote: null,
        numericUnit: null,
        numericMin: null,
        numericMax: null,
        textMaxLength: null,
        completionType: 'MULTIPLE',
        maxCompletions: null,
        responses: [],
        canUndo: false,
        completedByCount: 0,
        totalActiveEmployees: 4,
        completedByNames: [],
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByText('Not Answered')).toBeInTheDocument()
    expect(screen.queryByText(/Completed By/)).not.toBeInTheDocument()
    // The old per-response name + time list must no longer render for MULTIPLE tasks.
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
  })

  it('shows the X/Y Completed By count and info icon for a MULTIPLE task with at least one active response', async () => {
    mockGetDailyChecklist.mockResolvedValue([{
      id: 1, name: 'Category',
      tasks: [
        {
          id: 7,
          name: 'Wipe tables',
          description: null,
          responseType: 'DONE_NOT_DONE',
          responseNote: null,
          numericUnit: null,
          numericMin: null,
          numericMax: null,
          textMaxLength: null,
          completionType: 'MULTIPLE',
          maxCompletions: null,
          responses: [
            {
              id: 1,
              employeeUserId: 100,
              employeeFullName: 'Alex Employee',
              booleanValue: true,
              numericValue: null,
              textValue: null,
              respondedAt: new Date().toISOString(),
              flaggedNeedsCorrection: false,
              flagReason: null,
            },
          ],
          canUndo: false,
          completedByCount: 2,
          totalActiveEmployees: 4,
          completedByNames: ['Alex Employee', 'Jordan Employee'],
        },
        // flagged task keeps completedTasks < totalTasks so All Done card doesn't appear
        progressTask({
          id: 99,
          responses: [{ ...DONE_RESPONSE, id: 2, flaggedNeedsCorrection: true, flagReason: 'Redo' }],
          canUndo: false,
        }),
      ],
    }])
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByText(/2\/4 Completed By/)).toBeInTheDocument()
    // Old status text and the old responder name + time list must not also render.
    expect(screen.queryByText('Not Answered')).not.toBeInTheDocument()
    expect(screen.queryByRole('list')).not.toBeInTheDocument()

    // The tooltip is closed by default -- no name leaks into the DOM until opened.
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('shows each active responder name, from backend data, in the info tooltip on hover', async () => {
    mockGetDailyChecklist.mockResolvedValue(
      checklistWith({
        id: 9,
        name: 'Wipe tables',
        description: null,
        responseType: 'DONE_NOT_DONE',
        responseNote: null,
        numericUnit: null,
        numericMin: null,
        numericMax: null,
        textMaxLength: null,
        completionType: 'MULTIPLE',
        maxCompletions: null,
        responses: [],
        canUndo: false,
        completedByCount: 2,
        totalActiveEmployees: 4,
        completedByNames: ['Alex Employee', 'Jordan Employee'],
      }),
    )
    const user = userEvent.setup()
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    const infoIcon = await screen.findByRole('button', { name: /who completed wipe tables today/i })
    await user.hover(infoIcon)

    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent('Alex Employee')
    expect(tooltip).toHaveTextContent('Jordan Employee')

    await user.unhover(infoIcon)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('also shows the info tooltip on click, for touch devices', async () => {
    mockGetDailyChecklist.mockResolvedValue(
      checklistWith({
        id: 10,
        name: 'Wipe tables',
        description: null,
        responseType: 'DONE_NOT_DONE',
        responseNote: null,
        numericUnit: null,
        numericMin: null,
        numericMax: null,
        textMaxLength: null,
        completionType: 'MULTIPLE',
        maxCompletions: null,
        responses: [],
        canUndo: false,
        completedByCount: 1,
        totalActiveEmployees: 4,
        completedByNames: ['Alex Employee'],
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    // A raw click (no synthesized hover, unlike userEvent.click) is what a real
    // touch tap looks like -- touch devices don't fire mouseenter/mouseleave.
    const infoIcon = await screen.findByRole('button', { name: /who completed wipe tables today/i })
    fireEvent.click(infoIcon)
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Alex Employee')

    fireEvent.click(infoIcon)
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
  })

  it('never shows the X/Y count for a SINGLE task, and shows the completing employee\'s name instead', async () => {
    mockGetDailyChecklist.mockResolvedValue([{
      id: 1, name: 'Category',
      tasks: [
        {
          id: 8,
          name: 'Unlock front door',
          description: null,
          responseType: 'DONE_NOT_DONE',
          responseNote: null,
          numericUnit: null,
          numericMin: null,
          numericMax: null,
          textMaxLength: null,
          completionType: 'SINGLE',
          maxCompletions: null,
          responses: [
            {
              id: 1,
              employeeUserId: 100,
              employeeFullName: 'Alex Employee',
              booleanValue: true,
              numericValue: null,
              textValue: null,
              respondedAt: new Date().toISOString(),
              flaggedNeedsCorrection: false,
              flagReason: null,
            },
          ],
          canUndo: false,
          completedByCount: 1,
          totalActiveEmployees: 4,
          completedByNames: ['Alex Employee'],
        },
        // open task keeps completedTasks < totalTasks so All Done card doesn't appear
        progressTask({ id: 99, name: 'Pending task' }),
      ],
    }])
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByText('Completed by Alex Employee')).toBeInTheDocument()
    expect(screen.queryByText(/Completed By/)).not.toBeInTheDocument()
  })
})

function progressTask(overrides: Partial<ChecklistCategory['tasks'][number]>): ChecklistCategory['tasks'][number] {
  return {
    id: 1,
    name: 'Task',
    description: null,
    responseType: 'DONE_NOT_DONE',
    responseNote: null,
    numericUnit: null,
    numericMin: null,
    numericMax: null,
    textMaxLength: null,
    completionType: 'SINGLE',
    maxCompletions: null,
    responses: [],
    canUndo: false,
    completedByCount: 0,
    totalActiveEmployees: 1,
    completedByNames: [],
    ...overrides,
  }
}

const DONE_RESPONSE = {
  id: 1,
  employeeUserId: 99,
  employeeFullName: 'Test Employee',
  booleanValue: true,
  numericValue: null,
  textValue: null,
  respondedAt: new Date().toISOString(),
  flaggedNeedsCorrection: false,
  flagReason: null,
}

describe('Daily progress indicator', () => {
  it('shows the overall completed/scheduled count and percentage in the header', async () => {
    mockGetDailyChecklist.mockResolvedValue([
      {
        id: 1,
        name: 'Preparation',
        tasks: [
          progressTask({ id: 1, name: 'Task 1', responses: [DONE_RESPONSE] }),
          progressTask({ id: 2, name: 'Task 2' }),
        ],
      },
    ])
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByText('50%')).toBeInTheDocument()
  })

  it('shows each category\'s own completed/total sub-fraction', async () => {
    mockGetDailyChecklist.mockResolvedValue([
      {
        id: 1,
        name: 'Preparation',
        tasks: [
          progressTask({ id: 1, responses: [DONE_RESPONSE] }),
          progressTask({ id: 2 }),
        ],
      },
      {
        id: 2,
        name: 'Cleaning',
        tasks: [
          progressTask({ id: 3, responses: [DONE_RESPONSE] }),
          progressTask({ id: 4, responses: [DONE_RESPONSE] }),
        ],
      },
    ])
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByRole('heading', { name: 'Preparation' })).toBeInTheDocument()
    // Fraction appears in both the overview strip and the accordion count badge
    expect(screen.getAllByText('1/2').length).toBeGreaterThan(0)
    expect(screen.getByRole('heading', { name: 'Cleaning' })).toBeInTheDocument()
    expect(screen.getAllByText('2/2').length).toBeGreaterThan(0)
  })

  it('shows 0/0 - 0% with no scheduled tasks, without dividing by zero', async () => {
    mockGetDailyChecklist.mockResolvedValue([])
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByText('0%')).toBeInTheDocument()
  })

  it('shows 100% when every scheduled task is completed', async () => {
    mockGetDailyChecklist.mockResolvedValue([
      {
        id: 1,
        name: 'Preparation',
        tasks: [
          progressTask({ id: 1, responses: [DONE_RESPONSE] }),
          progressTask({ id: 2, responses: [DONE_RESPONSE] }),
        ],
      },
    ])
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByText('100%')).toBeInTheDocument()
  })

  it('updates the overall and category counts immediately after a task submission, with no page reload', async () => {
    mockGetDailyChecklist.mockResolvedValue([
      {
        id: 1,
        name: 'Preparation',
        tasks: [
          progressTask({ id: 1, name: 'Wipe counters' }),
          progressTask({ id: 2, name: 'Check supplies', responseType: 'YES_NO' }),
        ],
      },
    ])
    mockSubmitTaskResponse.mockResolvedValue({
      taskId: 1,
      responses: [DONE_RESPONSE],
      canUndo: true,
      completedByCount: 1,
      totalActiveEmployees: 1,
      completedByNames: ['Test Employee'],
    })

    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByText('0%')).toBeInTheDocument()
    // Fraction appears in both the overview strip and the accordion count badge
    expect(screen.getAllByText('0/2').length).toBeGreaterThan(0)

    await userEvent.click(screen.getByRole('button', { name: /done/i }))

    expect(await screen.findByText('50%')).toBeInTheDocument()
    expect(screen.getAllByText('1/2').length).toBeGreaterThan(0)
    // Exactly one submit call -- no duplicate/stale count from a second request.
    expect(mockSubmitTaskResponse).toHaveBeenCalledTimes(1)
  })

  it('computes progress independently per store', async () => {
    mockGetDailyChecklist.mockResolvedValueOnce([
      { id: 1, name: 'Preparation', tasks: [progressTask({ id: 1, responses: [DONE_RESPONSE] })] },
    ])
    const { unmount } = render(<EmployeeDashboard store={{ ...STORE, id: 1 }} onLogout={() => {}} employeeId={99} />)
    expect(await screen.findByText('100%')).toBeInTheDocument()
    expect(mockGetDailyChecklist).toHaveBeenCalledWith(1)
    unmount()

    mockGetDailyChecklist.mockResolvedValueOnce([
      { id: 1, name: 'Preparation', tasks: [progressTask({ id: 2 })] },
    ])
    render(<EmployeeDashboard store={{ ...STORE, id: 2 }} onLogout={() => {}} employeeId={99} />)
    expect(await screen.findByText('0%')).toBeInTheDocument()
    expect(mockGetDailyChecklist).toHaveBeenCalledWith(2)
  })
})

describe('Text draft persistence', () => {
  const TEXT_TASK: ChecklistCategory['tasks'][number] = {
    id: 20,
    name: 'Log issue',
    description: null,
    responseType: 'TEXT',
    responseNote: null,
    numericUnit: null,
    numericMin: null,
    numericMax: null,
    textMaxLength: 100,
    completionType: 'SINGLE',
    maxCompletions: null,
    responses: [],
    canUndo: false,
    completedByCount: 0,
    totalActiveEmployees: 1,
    completedByNames: [],
  }

  function todayKey(): string {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }

  beforeEach(() => {
    localStorage.clear()
  })

  it('seeds a text task draft from localStorage on mount when no confirmed response exists', async () => {
    const key = `draft:1:20:${todayKey()}`
    localStorage.setItem(key, 'partial notes')
    mockGetDailyChecklist.mockResolvedValue([{
      id: 1, name: 'Category',
      tasks: [TEXT_TASK, progressTask({ id: 99, name: 'Open task', responseType: 'YES_NO' })],
    }])

    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    const input = await screen.findByRole('textbox')
    expect(input).toHaveValue('partial notes')
  })

  it('does not seed a draft when the key belongs to a different date (date-scoping validation)', async () => {
    const yesterday = (() => {
      const d = new Date()
      d.setDate(d.getDate() - 1)
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    })()
    localStorage.setItem(`draft:1:20:${yesterday}`, 'old draft from yesterday')
    mockGetDailyChecklist.mockResolvedValue([{
      id: 1, name: 'Category',
      tasks: [TEXT_TASK, progressTask({ id: 99, name: 'Open task', responseType: 'YES_NO' })],
    }])

    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    const input = await screen.findByRole('textbox')
    // Yesterday's draft must not reappear — key includes today's date so old keys are ignored
    expect(input).toHaveValue('')
  })

  it('does not seed draft when task already has a confirmed response', async () => {
    const key = `draft:1:20:${todayKey()}`
    localStorage.setItem(key, 'stale draft')
    const taskWithResponse = {
      ...TEXT_TASK,
      responses: [{
        id: 1,
        employeeUserId: 99,
        employeeFullName: 'Test Employee',
        booleanValue: null,
        numericValue: null,
        textValue: 'confirmed value',
        respondedAt: new Date().toISOString(),
        flaggedNeedsCorrection: false,
        flagReason: null,
      }],
      canUndo: true,
    }
    mockGetDailyChecklist.mockResolvedValue([{
      id: 1, name: 'Category',
      tasks: [taskWithResponse, progressTask({ id: 99, name: 'Open task', responseType: 'YES_NO' })],
    }])

    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    const input = await screen.findByRole('textbox')
    // Confirmed response value wins; stale draft from localStorage must not override it
    expect(input).toHaveValue('confirmed value')
  })
})
