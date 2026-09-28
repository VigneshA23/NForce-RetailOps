import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationBell from './NotificationBell'
import * as notificationsApi from '../api/notifications'
import type { Notification } from '../types/notification'

vi.mock('../api/notifications', () => ({
  getNotifications: vi.fn(),
  markAllRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

const mockGetNotifications = vi.mocked(notificationsApi.getNotifications)
const mockMarkNotificationRead = vi.mocked(notificationsApi.markNotificationRead)

function makeNotification(overrides: Partial<Notification>): Notification {
  return {
    id: 1,
    title: 'Checklist reviewed',
    message: 'Your checklist history has an update.',
    category: 'CORRECTION_MADE',
    priority: 'NORMAL',
    read: false,
    linkPath: '/audit',
    relatedIssueId: null,
    relatedIssueNote: null,
    relatedStoreName: null,
    relatedIssueStatus: null,
    storeId: null,
    createdAt: '2026-09-17T09:00:00Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockGetNotifications.mockReset()
  mockMarkNotificationRead.mockReset()
  mockMarkNotificationRead.mockResolvedValue(makeNotification({}))
})

describe('NotificationBell — passing the notification date through navigation', () => {
  it("calls onNavigate with the clicked notification's own linkPath and createdAt", async () => {
    const user = userEvent.setup()
    mockGetNotifications.mockResolvedValue([
      makeNotification({ id: 1, title: "Today's item", createdAt: '2026-09-17T09:00:00Z' }),
    ])
    const onNavigate = vi.fn()

    render(<NotificationBell unreadCount={1} onCountChange={vi.fn()} onViewAll={vi.fn()} onNavigate={onNavigate} />)

    await user.click(screen.getByLabelText(/notifications/i))
    const item = await screen.findByText("Today's item")
    await user.click(item)

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/audit', { createdAt: '2026-09-17T09:00:00Z', relatedIssueId: null, storeId: null }))
  })

  it('passes each distinct notification\'s own createdAt, not a shared/default value', async () => {
    const user = userEvent.setup()
    mockGetNotifications.mockResolvedValue([
      makeNotification({ id: 1, title: "Today's item", createdAt: '2026-09-17T09:00:00Z' }),
      makeNotification({ id: 2, title: "Yesterday's item", createdAt: '2026-09-16T09:00:00Z' }),
    ])
    const onNavigate = vi.fn()

    render(<NotificationBell unreadCount={2} onCountChange={vi.fn()} onViewAll={vi.fn()} onNavigate={onNavigate} />)
    await user.click(screen.getByLabelText(/notifications/i))

    await user.click(await screen.findByText("Yesterday's item"))
    await waitFor(() => expect(onNavigate).toHaveBeenLastCalledWith('/audit', { createdAt: '2026-09-16T09:00:00Z', relatedIssueId: null, storeId: null }))

    await user.click(screen.getByLabelText(/notifications/i))
    await user.click(await screen.findByText("Today's item"))
    await waitFor(() => expect(onNavigate).toHaveBeenLastCalledWith('/audit', { createdAt: '2026-09-17T09:00:00Z', relatedIssueId: null, storeId: null }))
  })
})

describe('NotificationBell — issue deep links', () => {
  it('passes the related issue id so the Issues page can focus that issue', async () => {
    const user = userEvent.setup()
    mockGetNotifications.mockResolvedValue([
      makeNotification({
        id: 3,
        title: 'Jane raised an issue at Downtown',
        category: 'ISSUE_RAISED',
        linkPath: '/issues',
        relatedIssueId: 42,
        createdAt: '2026-09-18T09:00:00Z',
      }),
    ])
    const onNavigate = vi.fn()

    render(<NotificationBell unreadCount={1} onCountChange={vi.fn()} onViewAll={vi.fn()} onNavigate={onNavigate} />)
    await user.click(screen.getByLabelText(/notifications/i))
    await user.click(await screen.findByText('Jane raised an issue at Downtown'))

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/issues', { createdAt: '2026-09-18T09:00:00Z', relatedIssueId: 42, storeId: null }))
  })

  it('passes the related store id so a Super Admin checklist alert can skip the store picker', async () => {
    const user = userEvent.setup()
    mockGetNotifications.mockResolvedValue([
      makeNotification({
        id: 4,
        title: 'Downtown — no activity today',
        category: 'STORE_ZERO_ACTIVITY',
        linkPath: '/checklist',
        storeId: 7,
        createdAt: '2026-09-19T09:00:00Z',
      }),
    ])
    const onNavigate = vi.fn()

    render(<NotificationBell unreadCount={1} onCountChange={vi.fn()} onViewAll={vi.fn()} onNavigate={onNavigate} />)
    await user.click(screen.getByLabelText(/notifications/i))
    await user.click(await screen.findByText('Downtown — no activity today'))

    await waitFor(() => expect(onNavigate).toHaveBeenCalledWith('/checklist', { createdAt: '2026-09-19T09:00:00Z', relatedIssueId: null, storeId: 7 }))
  })
})
