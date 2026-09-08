import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useIssueUnreadBadge } from './useIssueUnreadBadge'
import * as issuesApi from '../api/issues'

vi.mock('../api/issues', () => ({
  getMyIssues: vi.fn(),
}))

const mockGetMyIssues = vi.mocked(issuesApi.getMyIssues)

function makeIssue(overrides: Partial<{ respondedAt: string | null }> = {}) {
  return {
    id: 1,
    storeId: 1,
    storeName: 'Store 1',
    employeeUserId: 99,
    employeeFullName: 'Test Employee',
    note: 'Something is wrong',
    status: 'RESOLVED' as const,
    raisedDate: '2026-09-01',
    responseText: 'Fixed it',
    respondedByFullName: 'Owner',
    respondedAt: new Date().toISOString(),
    createdAt: '2026-09-01T09:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  localStorage.clear()
  mockGetMyIssues.mockReset()
})

describe('useIssueUnreadBadge', () => {
  it('returns hasUnread=true when an issue was responded to after last-seen timestamp', async () => {
    // last seen 1 hour ago, issue responded to "now"
    const lastSeen = new Date(Date.now() - 3_600_000).toISOString()
    localStorage.setItem('issuesSeen:99', lastSeen)

    mockGetMyIssues.mockResolvedValue([makeIssue({ respondedAt: new Date().toISOString() })])

    const { result } = renderHook(() => useIssueUnreadBadge(99, 1))

    await waitFor(() => expect(result.current.hasUnread).toBe(true))
  })

  it('returns hasUnread=false when issue was responded to before last-seen timestamp', async () => {
    // last seen "now", issue responded to 1 hour ago
    localStorage.setItem('issuesSeen:99', new Date().toISOString())

    mockGetMyIssues.mockResolvedValue([
      makeIssue({ respondedAt: new Date(Date.now() - 3_600_000).toISOString() }),
    ])

    const { result } = renderHook(() => useIssueUnreadBadge(99, 1))

    await waitFor(() => expect(result.current.hasUnread).toBe(false))
  })

  it('returns hasUnread=true when no last-seen timestamp exists (first visit) and issue has respondedAt', async () => {
    // No localStorage entry = never visited Issues tab
    mockGetMyIssues.mockResolvedValue([makeIssue({ respondedAt: new Date().toISOString() })])

    const { result } = renderHook(() => useIssueUnreadBadge(99, 1))

    await waitFor(() => expect(result.current.hasUnread).toBe(true))
  })

  it('returns hasUnread=false when no issue has a respondedAt (all OPEN)', async () => {
    mockGetMyIssues.mockResolvedValue([makeIssue({ respondedAt: null })])

    const { result } = renderHook(() => useIssueUnreadBadge(99, 1))

    await waitFor(() => expect(result.current.hasUnread).toBe(false))
  })

  it('markSeen clears hasUnread and writes last-seen timestamp to localStorage', async () => {
    localStorage.setItem('issuesSeen:99', new Date(Date.now() - 3_600_000).toISOString())
    mockGetMyIssues.mockResolvedValue([makeIssue({ respondedAt: new Date().toISOString() })])

    const { result } = renderHook(() => useIssueUnreadBadge(99, 1))
    await waitFor(() => expect(result.current.hasUnread).toBe(true))

    act(() => { result.current.markSeen() })

    expect(result.current.hasUnread).toBe(false)
    expect(localStorage.getItem('issuesSeen:99')).not.toBeNull()
  })

  it('does nothing when employeeId is null', async () => {
    mockGetMyIssues.mockResolvedValue([])

    const { result } = renderHook(() => useIssueUnreadBadge(null, 1))

    // Give enough time for any async call to resolve
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(result.current.hasUnread).toBe(false)
    expect(mockGetMyIssues).not.toHaveBeenCalled()
  })
})
