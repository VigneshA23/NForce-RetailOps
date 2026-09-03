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
    mockGetDailyChecklist.mockResolvedValue(checklistWith(task))
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
    mockGetDailyChecklist.mockResolvedValue(
      checklistWith({
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
          },
        ],
        canUndo: false,
        completedByCount: 2,
        totalActiveEmployees: 4,
        completedByNames: ['Alex Employee', 'Jordan Employee'],
      }),
    )
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
    mockGetDailyChecklist.mockResolvedValue(
      checklistWith({
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
          },
        ],
        canUndo: false,
        completedByCount: 1,
        totalActiveEmployees: 4,
        completedByNames: ['Alex Employee'],
      }),
    )
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

    expect(await screen.findByText('Overall: 1/2 - 50%')).toBeInTheDocument()
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

    expect(await screen.findByText('Preparation')).toBeInTheDocument()
    expect(screen.getByText('1/2')).toBeInTheDocument()
    expect(screen.getByText('Cleaning')).toBeInTheDocument()
    expect(screen.getByText('2/2')).toBeInTheDocument()
  })

  it('shows 0/0 - 0% with no scheduled tasks, without dividing by zero', async () => {
    mockGetDailyChecklist.mockResolvedValue([])
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} employeeId={99} />)

    expect(await screen.findByText('Overall: 0/0 - 0%')).toBeInTheDocument()
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

    expect(await screen.findByText('Overall: 2/2 - 100%')).toBeInTheDocument()
  })

  it('updates the overall and category counts immediately after a task submission, with no page reload', async () => {
    mockGetDailyChecklist.mockResolvedValue([
      {
        id: 1,
        name: 'Preparation',
        tasks: [progressTask({ id: 1, name: 'Wipe counters' })],
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

    expect(await screen.findByText('Overall: 0/1 - 0%')).toBeInTheDocument()
    expect(screen.getByText('0/1')).toBeInTheDocument() // category sub-fraction

    await userEvent.click(screen.getByRole('button', { name: /done/i }))

    expect(await screen.findByText('Overall: 1/1 - 100%')).toBeInTheDocument()
    expect(screen.getByText('1/1')).toBeInTheDocument()
    // Exactly one submit call -- no duplicate/stale count from a second request.
    expect(mockSubmitTaskResponse).toHaveBeenCalledTimes(1)
  })

  it('computes progress independently per store', async () => {
    mockGetDailyChecklist.mockResolvedValueOnce([
      { id: 1, name: 'Preparation', tasks: [progressTask({ id: 1, responses: [DONE_RESPONSE] })] },
    ])
    const { unmount } = render(<EmployeeDashboard store={{ ...STORE, id: 1 }} onLogout={() => {}} employeeId={99} />)
    expect(await screen.findByText('Overall: 1/1 - 100%')).toBeInTheDocument()
    expect(mockGetDailyChecklist).toHaveBeenCalledWith(1)
    unmount()

    mockGetDailyChecklist.mockResolvedValueOnce([
      { id: 1, name: 'Preparation', tasks: [progressTask({ id: 2 })] },
    ])
    render(<EmployeeDashboard store={{ ...STORE, id: 2 }} onLogout={() => {}} employeeId={99} />)
    expect(await screen.findByText('Overall: 0/1 - 0%')).toBeInTheDocument()
    expect(mockGetDailyChecklist).toHaveBeenCalledWith(2)
  })
})
