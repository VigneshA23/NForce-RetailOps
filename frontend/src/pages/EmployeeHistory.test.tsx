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
  return { date, storeId, hasChecklist: false, categories: [] }
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
  // Regression test for the reported bug: at 2026-09-03 01:30 local time in a
  // timezone ahead of UTC (Asia/Kolkata, UTC+5:30), the UTC calendar date is
  // still 2026-09-02 -- a toISOString()-based "today" would request yesterday
  // even though the UI shows "Today" selected and the local date is 09-03.
  it('requests the current LOCAL date for "Today", not the UTC date', async () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    vi.setSystemTime(new Date('2026-09-02T20:00:00Z')) // 2026-09-03 01:30 IST

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)

    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalled())
    expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-03')
    expect(mockGetShiftHistory).not.toHaveBeenCalledWith(1, '2026-09-02')
  })

  it('requests LOCAL date minus one day for "Yesterday"', async () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    vi.setSystemTime(new Date('2026-09-02T20:00:00Z')) // local 2026-09-03 01:30

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)
    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-03'))

    mockGetShiftHistory.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Yesterday' }))

    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-02'))
  })

  it('re-selecting "Today" after "Yesterday" requests the current local date again', async () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    vi.setSystemTime(new Date('2026-09-02T20:00:00Z')) // local 2026-09-03 01:30

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)
    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-03'))

    fireEvent.click(screen.getByRole('button', { name: 'Yesterday' }))
    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-02'))

    mockGetShiftHistory.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Today' }))
    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-03'))
  })

  it('requests exactly the calendar-picked date, unaffected by timezone', async () => {
    vi.stubEnv('TZ', 'Asia/Kolkata')
    vi.setSystemTime(new Date('2026-09-02T20:00:00Z'))

    render(<EmployeeHistory store={STORE} stores={[STORE]} />)
    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-03'))
    mockGetShiftHistory.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Pick a date' }))
    const dialog = await screen.findByRole('dialog', { name: 'Choose a date' })
    // The 2nd of the displayed month (September 2026) -- a day before "today"
    // so it isn't disabled by the picker's max-date cutoff.
    fireEvent.click(within(dialog).getByRole('button', { name: '2' }))

    await waitFor(() => expect(mockGetShiftHistory).toHaveBeenCalledWith(1, '2026-09-02'))
  })
})
