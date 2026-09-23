import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import EmployeeDashboard from './EmployeeDashboard'
import * as tasksApi from '../api/tasks'
import type { ChecklistCategory, ChecklistTask } from '../types/task'
import type { StoreSummary } from '../types/store'

vi.mock('../api/tasks', () => ({
  getDailyChecklist: vi.fn(),
  submitTaskResponse: vi.fn(),
  undoTaskResponse: vi.fn(),
}))

const mockGetDailyChecklist = vi.mocked(tasksApi.getDailyChecklist)
const mockSubmitTaskResponse = vi.mocked(tasksApi.submitTaskResponse)

const STORE: StoreSummary = { id: 1, name: 'Store 1', location: 'Main St', status: 'Open' }

function task(overrides: Partial<ChecklistTask> = {}): ChecklistTask {
  return {
    id: 100,
    name: 'Sweep the floor',
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
    totalActiveEmployees: 1,
    completedByNames: [],
    originalDueDate: null,
    ...overrides,
  }
}

function category(tasks: ChecklistTask[]): ChecklistCategory {
  return { id: 1, name: 'Closing Checks', tasks }
}

beforeEach(() => {
  mockGetDailyChecklist.mockReset()
  mockSubmitTaskResponse.mockReset()
})

describe('EmployeeDashboard moved units', () => {
  it('renders a moved unit with its "Due <date>" badge under its category', async () => {
    mockGetDailyChecklist.mockResolvedValue([category([task({ originalDueDate: '2026-05-12' })])])
    render(<EmployeeDashboard store={STORE} onLogout={vi.fn()} employeeId={7} />)

    expect(await screen.findByText('Sweep the floor')).toBeInTheDocument()
    expect(screen.getByText(/due 12 may/i)).toBeInTheDocument()
  })

  it('renders a task with both a normal and a moved unit as two independent cards', async () => {
    mockGetDailyChecklist.mockResolvedValue([
      category([
        task({ id: 100, originalDueDate: null }),
        task({ id: 100, originalDueDate: '2026-05-12' }),
      ]),
    ])
    render(<EmployeeDashboard store={STORE} onLogout={vi.fn()} employeeId={7} />)

    const names = await screen.findAllByText('Sweep the floor')
    expect(names).toHaveLength(2)
    // Independent controls: two "Yes"/"No" button pairs, not merged into one.
    expect(screen.getAllByRole('button', { name: 'Yes' })).toHaveLength(2)
    expect(screen.getAllByRole('button', { name: 'No' })).toHaveLength(2)
  })

  it("includes originalDueDate in a moved unit's submit payload, and only updates that unit's state", async () => {
    mockGetDailyChecklist.mockResolvedValue([
      category([
        task({ id: 100, originalDueDate: null }),
        task({ id: 100, originalDueDate: '2026-05-12' }),
      ]),
    ])
    mockSubmitTaskResponse.mockResolvedValue({
      taskId: 100,
      responses: [{
        id: 1, employeeUserId: 7, employeeFullName: 'Jane Doe', booleanValue: true, numericValue: null,
        textValue: null, respondedAt: '2026-05-12T00:00:00Z', flaggedNeedsCorrection: false, flagReason: null,
        completedVia: 'MOVED',
      }],
      canUndo: true,
      completedByCount: 1,
      totalActiveEmployees: 1,
      completedByNames: ['Jane Doe'],
      originalDueDate: '2026-05-12',
    })
    const user = userEvent.setup()
    render(<EmployeeDashboard store={STORE} onLogout={vi.fn()} employeeId={7} />)

    const yesButtons = await screen.findAllByRole('button', { name: 'Yes' })
    // Second card is the moved unit (originalDueDate set) per render order.
    await user.click(yesButtons[1])

    expect(mockSubmitTaskResponse).toHaveBeenCalledWith(100, {
      storeId: 1, booleanValue: true, originalDueDate: '2026-05-12',
    })

    // Only the moved unit shows a completed state; the normal unit is untouched.
    await screen.findByText(/answered yes/i)
    expect(screen.getAllByRole('button', { name: 'Yes' })).toHaveLength(1)
  })

  it('renders the Missed Tasks stat tile with the count and navigates on click', async () => {
    mockGetDailyChecklist.mockResolvedValue([category([task()])])
    const onNavigate = vi.fn()
    const user = userEvent.setup()
    render(<EmployeeDashboard store={STORE} onLogout={vi.fn()} employeeId={7} missedTasksCount={3} onNavigate={onNavigate} />)

    await screen.findByText('Sweep the floor')
    const tile = screen.getByText('Missed Tasks').closest('button')
    expect(tile).not.toBeNull()
    expect(tile).toHaveTextContent('3')

    await user.click(tile!)
    expect(onNavigate).toHaveBeenCalledWith('missing')
  })
})

describe('EmployeeDashboard TEXT/NUMERIC submit button', () => {
  it('disables the Submit button until a TEXT response is entered, and submits on click', async () => {
    mockGetDailyChecklist.mockResolvedValue([category([task({ responseType: 'TEXT' })])])
    mockSubmitTaskResponse.mockResolvedValue({
      taskId: 100, responses: [{
        id: 1, employeeUserId: 7, employeeFullName: 'Jane Doe', booleanValue: null, numericValue: null,
        textValue: 'All clear', respondedAt: '2026-05-12T00:00:00Z', flaggedNeedsCorrection: false, flagReason: null,
      }],
      canUndo: true, completedByCount: 1, totalActiveEmployees: 1, completedByNames: ['Jane Doe'], originalDueDate: null,
    })
    const user = userEvent.setup()
    render(<EmployeeDashboard store={STORE} onLogout={vi.fn()} employeeId={7} />)

    const submitButton = await screen.findByRole('button', { name: 'Submit' })
    expect(submitButton).toBeDisabled()

    const textInput = screen.getByPlaceholderText(/enter your response/i)
    await user.type(textInput, 'All clear')
    expect(submitButton).toBeEnabled()

    await user.click(submitButton)

    // Exactly once -- clicking Submit blurs the input as part of the click,
    // which must not also trigger a second, implicit submit-on-blur.
    expect(mockSubmitTaskResponse).toHaveBeenCalledTimes(1)
    expect(mockSubmitTaskResponse).toHaveBeenCalledWith(100, { storeId: 1, textValue: 'All clear' })
  })

  it('disables the Submit button until a NUMERIC response is entered, and submits on click', async () => {
    mockGetDailyChecklist.mockResolvedValue([category([task({ responseType: 'NUMERIC' })])])
    mockSubmitTaskResponse.mockResolvedValue({
      taskId: 100, responses: [{
        id: 1, employeeUserId: 7, employeeFullName: 'Jane Doe', booleanValue: null, numericValue: 42,
        textValue: null, respondedAt: '2026-05-12T00:00:00Z', flaggedNeedsCorrection: false, flagReason: null,
      }],
      canUndo: true, completedByCount: 1, totalActiveEmployees: 1, completedByNames: ['Jane Doe'], originalDueDate: null,
    })
    const user = userEvent.setup()
    const { container } = render(<EmployeeDashboard store={STORE} onLogout={vi.fn()} employeeId={7} />)

    const submitButton = await screen.findByRole('button', { name: 'Submit' })
    expect(submitButton).toBeDisabled()

    const numericInput = container.querySelector('.checklist-task__numeric-input') as HTMLInputElement
    await user.type(numericInput, '42')
    expect(submitButton).toBeEnabled()

    await user.click(submitButton)

    expect(mockSubmitTaskResponse).toHaveBeenCalledTimes(1)
    expect(mockSubmitTaskResponse).toHaveBeenCalledWith(100, { storeId: 1, numericValue: 42 })
  })

  it('hides the Submit button (and locks the input) once already answered', async () => {
    // A second, still-open task keeps the checklist in its normal list view
    // rather than collapsing into the "All Done for Today" summary card.
    mockGetDailyChecklist.mockResolvedValue([category([
      task({
        id: 100,
        responseType: 'TEXT',
        responses: [{
          id: 1, employeeUserId: 7, employeeFullName: 'Jane Doe', booleanValue: null, numericValue: null,
          textValue: 'All clear', respondedAt: '2026-05-12T00:00:00Z', flaggedNeedsCorrection: false, flagReason: null,
        }],
        canUndo: true,
      }),
      task({ id: 101, name: 'Lock the back door' }),
    ])])
    render(<EmployeeDashboard store={STORE} onLogout={vi.fn()} employeeId={7} />)

    const textInput = await screen.findByDisplayValue('All clear')
    expect(textInput).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument()
  })

  it('still shows the Submit button when a response is flagged for correction, even though one already exists', async () => {
    mockGetDailyChecklist.mockResolvedValue([category([task({
      responseType: 'TEXT',
      responses: [{
        id: 1, employeeUserId: 7, employeeFullName: 'Jane Doe', booleanValue: null, numericValue: null,
        textValue: 'Wrong value', respondedAt: '2026-05-12T00:00:00Z', flaggedNeedsCorrection: true, flagReason: 'Please redo',
      }],
      canUndo: true,
    })])])
    render(<EmployeeDashboard store={STORE} onLogout={vi.fn()} employeeId={7} />)

    const textInput = await screen.findByDisplayValue('Wrong value')
    expect(textInput).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument()
  })
})
