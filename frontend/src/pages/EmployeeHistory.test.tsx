import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EmployeeHistory from './EmployeeHistory'
import * as historyApi from '../api/history'
import type { ShiftHistory } from '../types/history'
import type { StoreSummary } from '../types/store'

vi.mock('../api/history', () => ({
  getShiftHistory: vi.fn(),
}))

const mockGetShiftHistory = vi.mocked(historyApi.getShiftHistory)

const STORE: StoreSummary = { id: 1, name: 'Downtown', location: null, status: 'Open' }

function emptyHistory(storeId: number, date: string): ShiftHistory {
  return { date, storeId, hasChecklist: false, categories: [], issues: [] }
}

// Mirrors EmployeeHistory's own formatDateLabel exactly, rather than
// hardcoding an expected string -- the test environment's default locale
// formats "short month" differently from en-US (e.g. "2 Sept 2026" instead
// of "Sep 2, 2026"), so the two must be computed the same way.
function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

beforeEach(() => {
  mockGetShiftHistory.mockReset()
  mockGetShiftHistory.mockImplementation((storeId, date) => Promise.resolve(emptyHistory(storeId, date)))
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
})

describe('EmployeeHistory date selection', () => {
  // Regression test for the original "Today" bug, now applied to the new
  // default: at 2026-09-03 01:30 local time in a timezone ahead of UTC
  // (Asia/Kolkata, UTC+5:30), the UTC calendar date is still 2026-09-02 -- a
  // toISOString()-based "yesterday" would request two days back even though
  // the local date is 09-03 and "yesterday" should be 09-02.
  it('defaults to the current LOCAL date minus one day, not the UTC date', async () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    vi.setSystemTime(new Date('2026-09-02T20:00:00Z')) // 2026-09-03 01:30 IST

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)

    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalled())
    expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-02')
  })

  it('shows the selected date label next to the calendar icon', async () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    vi.setSystemTime(new Date('2026-09-02T20:00:00Z')) // local 2026-09-03, so default is 2026-09-02

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)
    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalled())

    expect(screen.getByRole('button', { name: 'Pick a date' })).toHaveTextContent(formatDateLabel('2026-09-02'))
  })

  it('requests exactly the calendar-picked date, unaffected by timezone, and updates the label', async () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    vi.setSystemTime(new Date('2026-09-02T20:00:00Z')) // local 2026-09-03

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)
    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-02'))
    mockGetShiftHistory.mockClear()

    const trigger = screen.getByRole('button', { name: 'Pick a date' })
    fireEvent.click(trigger)
    const dialog = await screen.findByRole('dialog', { name: 'Choose a date' })
    // The 1st of the displayed month (September 2026) -- on or before "today"
    // (the 3rd locally), so it isn't disabled by the picker's max-date cutoff.
    fireEvent.click(within(dialog).getByRole('button', { name: '1' }))

    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-01'))
    expect(trigger).toHaveTextContent(formatDateLabel('2026-09-01'))
  })
})

describe('EmployeeHistory task responder list', () => {
  it('lists every employee who completed a MULTIPLE-completion task, not just the caller', async () => {
    mockGetShiftHistory.mockResolvedValue({
      date: '2026-09-02',
      storeId: 1,
      hasChecklist: true,
      issues: [],
      categories: [
        {
          id: 10,
          name: 'Cleaning',
          tasksCompleted: 1,
          tasksTotal: 1,
          tasks: [
            {
              id: 100,
              name: 'Wipe counters',
              status: 'YES',
              completedBy: { employeeUserId: 2, name: 'Bob Teammate' },
              completedAt: '3:00 PM',
              completedByAll: [
                { employeeUserId: 1, name: 'Alice Caller', respondedAt: '2:00 PM' },
                { employeeUserId: 2, name: 'Bob Teammate', respondedAt: '3:00 PM' },
              ],
            },
          ],
        },
      ],
    })

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)
    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalled())

    expect(await screen.findByText('Alice Caller · 2:00 PM')).toBeInTheDocument()
    expect(screen.getByText('Bob Teammate · 3:00 PM')).toBeInTheDocument()
  })

  it('keeps the single-line responder view for a SINGLE-completion task', async () => {
    mockGetShiftHistory.mockResolvedValue({
      date: '2026-09-02',
      storeId: 1,
      hasChecklist: true,
      issues: [],
      categories: [
        {
          id: 10,
          name: 'Cleaning',
          tasksCompleted: 1,
          tasksTotal: 1,
          tasks: [
            {
              id: 100,
              name: 'Unlock front door',
              status: 'YES',
              completedBy: { employeeUserId: 1, name: 'Alice Caller' },
              completedAt: '2:00 PM',
              completedByAll: [{ employeeUserId: 1, name: 'Alice Caller', respondedAt: '2:00 PM' }],
            },
          ],
        },
      ],
    })

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)
    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalled())

    expect(await screen.findByText('Alice Caller · 2:00 PM')).toBeInTheDocument()
  })
})

// Proves the fix for "Raise with Owner" appearing in same-day History: an
// issue raised for a date shows up in that date's history view, independent
// of (and even in the absence of) any checklist task activity.
describe('EmployeeHistory raised issues', () => {
  it('renders an open issue with no checklist activity that day', async () => {
    mockGetShiftHistory.mockResolvedValue({
      date: '2026-09-02',
      storeId: 1,
      hasChecklist: false,
      categories: [],
      issues: [
        {
          id: 1,
          note: 'Freezer #2 is not cooling properly.',
          status: 'OPEN',
          responseText: null,
          respondedByName: null,
          respondedAt: null,
          raisedAt: '9:00 AM',
        },
      ],
    })

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)

    expect(await screen.findByText('Raised Issues')).toBeInTheDocument()
    expect(screen.getByText('Freezer #2 is not cooling properly.')).toBeInTheDocument()
    expect(screen.getByText('Open')).toBeInTheDocument()
    expect(screen.getByText('Raised at 9:00 AM')).toBeInTheDocument()
    // No checklist activity at all this day -- the empty state must not show
    // once an issue counts as activity.
    expect(screen.queryByText('Nothing logged yet')).not.toBeInTheDocument()
  })

  it("renders an owner's response once resolved", async () => {
    mockGetShiftHistory.mockResolvedValue({
      date: '2026-09-02',
      storeId: 1,
      hasChecklist: false,
      categories: [],
      issues: [
        {
          id: 1,
          note: 'Freezer #2 is not cooling properly.',
          status: 'RESOLVED',
          responseText: "We've scheduled a repair for tomorrow.",
          respondedByName: 'Store Owner',
          respondedAt: '10:00 AM',
          raisedAt: '9:00 AM',
        },
      ],
    })

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)

    expect(await screen.findByText('Resolved')).toBeInTheDocument()
    expect(screen.getByText("We've scheduled a repair for tomorrow.")).toBeInTheDocument()
    expect(screen.getByText('Store Owner · 10:00 AM')).toBeInTheDocument()
  })
})
