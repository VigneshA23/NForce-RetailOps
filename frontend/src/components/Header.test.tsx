import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Header from './Header';

function renderHeader(overrides: Partial<Parameters<typeof Header>[0]> = {}) {
  return render(
    <Header
      title="RetailOps"
      searchValue=""
      onSearchChange={vi.fn()}
      isDarkTheme={false}
      onToggleTheme={vi.fn()}
      userName="Jane Doe"
      onLogout={vi.fn()}
      {...overrides}
    />,
  );
}

// Proves the fix wiring the header bell to the Notifications page: clicking
// it fires onNotificationsClick (the shell then swaps in the Notifications
// overlay), and the unread count renders as a badge on the icon.
describe('Header notifications bell', () => {
  it('calls onNotificationsClick when the bell is clicked', async () => {
    const onNotificationsClick = vi.fn();
    renderHeader({ onNotificationsClick });

    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(onNotificationsClick).toHaveBeenCalledTimes(1);
  });

  it('does not render a badge when there are no unread notifications', () => {
    renderHeader({ onNotificationsClick: vi.fn(), notificationCount: 0 });

    const bell = screen.getByRole('button', { name: 'Notifications' });
    expect(bell.querySelector('.icon-button__badge')).not.toBeInTheDocument();
  });

  it('renders the unread count as a badge on the bell', () => {
    renderHeader({ onNotificationsClick: vi.fn(), notificationCount: 3 });

    const bell = screen.getByRole('button', { name: 'Notifications' });
    expect(bell.querySelector('.icon-button__badge')).toHaveTextContent('3');
  });

  it('caps the badge at "9+" for large counts', () => {
    renderHeader({ onNotificationsClick: vi.fn(), notificationCount: 42 });

    const bell = screen.getByRole('button', { name: 'Notifications' });
    expect(bell.querySelector('.icon-button__badge')).toHaveTextContent('9+');
  });

  it('omits the bell entirely when showNotifications is false', () => {
    renderHeader({ showNotifications: false, onNotificationsClick: vi.fn() });

    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
  });
});
