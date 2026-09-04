import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import EmployeeShell from './EmployeeShell';
import * as tasksApi from '../api/tasks';
import * as notificationsApi from '../api/notifications';
import type { AuthUser } from '../types/auth';
import type { StoreSummary } from '../types/store';

vi.mock('../api/tasks', () => ({
  getDailyChecklist: vi.fn(),
  raiseIssue: vi.fn(),
  submitTaskResponse: vi.fn(),
  undoTaskResponse: vi.fn(),
}));

vi.mock('../api/notifications', () => ({
  getNotifications: vi.fn(),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
}));

const USER: AuthUser = { token: 'token', role: 'EMPLOYEE', fullName: 'Jane Doe' };
const STORE: StoreSummary = { id: 1, name: 'Downtown Store', location: null, status: 'Open' };

beforeEach(() => {
  vi.mocked(tasksApi.getDailyChecklist).mockResolvedValue([]);
  vi.mocked(notificationsApi.getNotifications).mockResolvedValue([
    {
      id: 1,
      title: 'Response to your issue at Downtown Store',
      message: "We've scheduled a repair for tomorrow.",
      category: 'ISSUE_RESPONSE',
      priority: 'NORMAL',
      read: false,
      createdAt: new Date().toISOString(),
    },
  ]);
});

// Proves the fix wiring the header bell to a dedicated Notifications page:
// clicking it swaps the shell's content over to Notifications, and the
// unread count fetched by useNotifications renders as a badge on the bell.
describe('EmployeeShell notifications navigation', () => {
  it('clicking the notification bell navigates to the Notifications page', async () => {
    render(
      <EmployeeShell
        user={USER}
        store={STORE}
        stores={[STORE]}
        onLogout={vi.fn()}
        onSwitchStore={vi.fn()}
      />,
    );

    const bell = await screen.findByRole('button', { name: 'Notifications' });
    expect(bell.querySelector('.icon-button__badge')).toHaveTextContent('1');

    await userEvent.click(bell);

    // The header's own title also becomes "Notifications" once this overlay is
    // active, so the page content itself (not the heading text, which then
    // matches twice) is what proves navigation actually happened.
    expect(await screen.findByText("We've scheduled a repair for tomorrow.")).toBeInTheDocument();
    expect(screen.getByText('1 unread')).toBeInTheDocument();
  });
});
