import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import NotificationBell from './NotificationBell'
import * as notificationsApi from '../api/notifications'
import type { Notification } from '../types/notification'
import type { StoreSummary } from '../types/store'

vi.mock('../api/notifications', () => ({
  getNotifications: vi.fn(),
  markAllRead: vi.fn(),
  markNotificationRead: vi.fn(),
}))

const mockGetNotifications = vi.mocked(notificationsApi.getNotifications)
const mockMarkNotificationRead = vi.mocked(notificationsApi.markNotificationRead)
const assignedStores: StoreSummary[] = [
  { id: 1, name: 'Store Alpha', location: null, status: 'Open' },
  { id: 2, name: 'Store Beta', location: null, status: 'Open' },
]

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

describe('NotificationBell — active employee store preview', () => {
  it('shows active-store and unresolved notifications, excludes other and unassigned stores, and refreshes on store change', async () => {
    const user = userEvent.setup()
    mockGetNotifications.mockResolvedValue([
      makeNotification({ id: 1, title: 'Alpha task', storeId: 1 }),
      makeNotification({ id: 2, title: 'Beta task', storeId: 2 }),
      makeNotification({ id: 3, title: 'Unspecified task', storeId: null }),
      makeNotification({ id: 4, title: 'Unassigned task', storeId: 99 }),
    ])
    const props = {
      unreadCount: 0,
      onCountChange: vi.fn(),
      onViewAll: vi.fn(),
      assignedStores,
      activeStoreId: 1,
    }
    const { rerender } = render(<NotificationBell {...props} />)

    await user.click(screen.getByLabelText('Notifications'))
    expect(await screen.findByText('Alpha task')).toBeInTheDocument()
    expect(screen.getByText('Unspecified task')).toBeInTheDocument()
    expect(screen.queryByText('Beta task')).not.toBeInTheDocument()
    expect(screen.queryByText('Unassigned task')).not.toBeInTheDocument()
    expect(Array.from(document.querySelectorAll('.nb-item__msg')).map((element) => element.textContent))
      .toContain('Store Alpha · Your checklist history has an update.')
    expect(screen.getByText('Store Alpha', { selector: 'strong' })).toBeInTheDocument()
    expect(Array.from(document.querySelectorAll('.nb-item__msg')).map((element) => element.textContent))
      .toContain('Store not specified · Your checklist history has an update.')

    rerender(<NotificationBell {...props} activeStoreId={2} />)

    expect(await screen.findByText('Beta task')).toBeInTheDocument()
    expect(screen.queryByText('Alpha task')).not.toBeInTheDocument()
    expect(screen.getByText('Unspecified task')).toBeInTheDocument()
  })

  it('continues to show the original unfiltered preview outside employee store context', async () => {
    const user = userEvent.setup()
    mockGetNotifications.mockResolvedValue([
      makeNotification({
        id: 1,
        title: 'Alpha task',
        message: 'A task was added at Store Alpha.',
        relatedStoreName: 'Store Alpha',
        storeId: 1,
      }),
      makeNotification({ id: 2, title: 'Beta task', storeId: 2 }),
    ])

    render(<NotificationBell unreadCount={0} onCountChange={vi.fn()} onViewAll={vi.fn()} />)
    await user.click(screen.getByLabelText('Notifications'))

    expect(await screen.findByText('Alpha task')).toBeInTheDocument()
    expect(screen.getByText('Beta task')).toBeInTheDocument()
    expect(screen.getByText('Store Alpha', { selector: 'strong' })).toBeInTheDocument()
  })

  it('paginates until it finds the latest active-store preview after unrelated-store notifications', async () => {
    const user = userEvent.setup()
    const otherStorePage = Array.from({ length: 100 }, (_, index) =>
      makeNotification({ id: index + 1, title: `Beta task ${index + 1}`, storeId: 2 }),
    )
    mockGetNotifications
      .mockResolvedValueOnce(otherStorePage)
      .mockResolvedValueOnce([
        makeNotification({ id: 101, title: 'Alpha recent task', storeId: 1 }),
      ])

    render(
      <NotificationBell
        unreadCount={0}
        onCountChange={vi.fn()}
        onViewAll={vi.fn()}
        assignedStores={assignedStores}
        activeStoreId={1}
      />,
    )
    await user.click(screen.getByLabelText('Notifications'))

    expect(await screen.findByText('Alpha recent task')).toBeInTheDocument()
    expect(screen.queryByText('Beta task 1')).not.toBeInTheDocument()
    expect(mockGetNotifications).toHaveBeenNthCalledWith(1, 0, 100)
    expect(mockGetNotifications).toHaveBeenNthCalledWith(2, 1, 100)
  })
})
