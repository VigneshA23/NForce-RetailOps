import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployeeDashboard from './EmployeeDashboard'
import * as tasksApi from '../api/tasks'
import * as meApi from '../api/me'
import type { ChecklistCategory } from '../types/task'
import type { StoreSummary } from '../types/store'

vi.mock('../api/tasks', () => ({
  getDailyChecklist: vi.fn(),
  raiseIssue: vi.fn(),
  submitTaskResponse: vi.fn(),
  undoTaskResponse: vi.fn(),
}))

vi.mock('../api/me', () => ({
  getMe: vi.fn(),
}))

const mockGetDailyChecklist = vi.mocked(tasksApi.getDailyChecklist)
const mockSubmitTaskResponse = vi.mocked(tasksApi.submitTaskResponse)
const mockGetMe = vi.mocked(meApi.getMe)

const STORE: StoreSummary = { id: 1, name: 'Store 1', location: 'Main St', status: 'Open' }

function checklistWith(task: ChecklistCategory['tasks'][number]): ChecklistCategory[] {
  return [{ id: 1, name: 'Category', tasks: [task] }]
}

beforeEach(() => {
  mockGetDailyChecklist.mockReset()
  mockSubmitTaskResponse.mockReset()
  mockGetMe.mockReset()
  mockGetMe.mockResolvedValue({
    id: 99,
    fullName: 'Test Employee',
    email: 'test@example.com',
    role: 'EMPLOYEE',
    storeNames: ['Store 1'],
    mustResetPassword: false,
  })
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
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} />)

    expect(await screen.findByRole('button', { name: 'Yes' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument()
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
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} />)

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
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} />)

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
      }),
    )
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} />)

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
    })

    const user = userEvent.setup()
    render(<EmployeeDashboard store={STORE} onLogout={() => {}} />)

    const input = await screen.findByRole('textbox')
    await user.type(input, 'All clear')
    await user.tab()

    expect(mockSubmitTaskResponse).toHaveBeenCalledWith(5, { storeId: 1, textValue: 'All clear' })
    expect(await screen.findByText('✓ All clear — You')).toBeInTheDocument()
  })
})
