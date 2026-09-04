import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Notifications from './Notifications';
import type { NotificationItem } from '../api/notifications';

function notification(overrides: Partial<NotificationItem> = {}): NotificationItem {
  return {
    id: 1,
    title: 'Response to your issue at Downtown Store',
    message: "We've scheduled a repair for tomorrow.",
    category: 'ISSUE_RESPONSE',
    priority: 'NORMAL',
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderPage(overrides: Partial<Parameters<typeof Notifications>[0]> = {}) {
  const onRetry = vi.fn();
  const onMarkRead = vi.fn();
  const onMarkAllRead = vi.fn();
  render(
    <Notifications
      notifications={[]}
      isLoading={false}
      error={null}
      onRetry={onRetry}
      onMarkRead={onMarkRead}
      onMarkAllRead={onMarkAllRead}
      {...overrides}
    />,
  );
  return { onRetry, onMarkRead, onMarkAllRead };
}

describe('Notifications page', () => {
  it('shows the unread and total counts', () => {
    renderPage({
      notifications: [notification({ id: 1, read: false }), notification({ id: 2, read: true })],
    });

    expect(screen.getByText('1 unread')).toBeInTheDocument();
    expect(screen.getByText('2 total')).toBeInTheDocument();
  });

  it("groups today's notifications separately from earlier ones", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    renderPage({
      notifications: [
        notification({ id: 1, title: 'Today notice', createdAt: new Date().toISOString() }),
        notification({ id: 2, title: 'Older notice', createdAt: yesterday.toISOString() }),
      ],
    });

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();
    expect(screen.getByText('Today notice')).toBeInTheDocument();
    expect(screen.getByText('Older notice')).toBeInTheDocument();
  });

  it('filters by search text', async () => {
    renderPage({
      notifications: [
        notification({ id: 1, title: 'Freezer issue response' }),
        notification({ id: 2, title: 'Unrelated notice', message: 'Something else entirely' }),
      ],
    });

    await userEvent.type(screen.getByPlaceholderText('Search notifications'), 'freezer');

    expect(screen.getByText('Freezer issue response')).toBeInTheDocument();
    expect(screen.queryByText('Unrelated notice')).not.toBeInTheDocument();
  });

  it('filters by read/unread status', async () => {
    renderPage({
      notifications: [
        notification({ id: 1, title: 'Unread one', read: false }),
        notification({ id: 2, title: 'Read one', read: true }),
      ],
    });

    await userEvent.selectOptions(screen.getByLabelText('Filter by read status'), 'READ');

    expect(screen.queryByText('Unread one')).not.toBeInTheDocument();
    expect(screen.getByText('Read one')).toBeInTheDocument();
  });

  it('marks a notification read when its card is clicked', async () => {
    const { onMarkRead } = renderPage({
      notifications: [notification({ id: 7, title: 'Click me', read: false })],
    });

    await userEvent.click(screen.getByText('Click me'));

    expect(onMarkRead).toHaveBeenCalledWith(7);
  });

  it('calls onMarkAllRead when "Mark all as read" is clicked, and disables it when nothing is unread', async () => {
    const { onMarkAllRead } = renderPage({
      notifications: [notification({ id: 1, read: false })],
    });

    const button = screen.getByRole('button', { name: /mark all as read/i });
    expect(button).toBeEnabled();
    await userEvent.click(button);
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);
  });

  it('disables "Mark all as read" when there is nothing unread', () => {
    renderPage({ notifications: [notification({ id: 1, read: true })] });

    expect(screen.getByRole('button', { name: /mark all as read/i })).toBeDisabled();
  });

  it('shows the empty state when there are no notifications', () => {
    renderPage({ notifications: [] });

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('shows the loading skeleton instead of content while loading', () => {
    renderPage({ notifications: [], isLoading: true });

    expect(screen.queryByText('No notifications')).not.toBeInTheDocument();
  });

  it('shows an error state with a retry action', async () => {
    const { onRetry } = renderPage({ notifications: [], error: 'Failed to load notifications' });

    expect(screen.getByText('Failed to load notifications')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
