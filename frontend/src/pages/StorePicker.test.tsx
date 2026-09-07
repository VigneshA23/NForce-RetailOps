import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StorePicker from './StorePicker';
import type { StoreSummary } from '../types/store';
import type { AuthUser } from '../types/auth';

const USER: AuthUser = { token: 'token', role: 'EMPLOYEE', fullName: 'Asha Rao' };

function store(overrides: Partial<StoreSummary> = {}): StoreSummary {
  return { id: 1, name: 'Downtown Store', location: 'Downtown', status: 'Open', ...overrides };
}

// Proves the fix for the stale-card bug: an Admin can remove the employee's
// assignment to a store while the employee's session is already open. The
// picker's own store list is only as fresh as the last fetch, so it must
// re-fetch every time it's actually shown (not just once at login) or a
// removed store's card would keep appearing.
describe('StorePicker', () => {
  it('re-fetches the store list every time it mounts', () => {
    const onReload = vi.fn();
    render(
      <StorePicker
        user={USER}
        stores={[store()]}
        onSelectStore={vi.fn()}
        onReload={onReload}
        onLogout={vi.fn()}
      />,
    );

    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('renders exactly the stores it is given, and nothing else', () => {
    render(
      <StorePicker
        user={USER}
        stores={[store({ id: 1, name: 'Downtown Store' })]}
        onSelectStore={vi.fn()}
        onReload={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    expect(screen.getByText('Downtown Store')).toBeInTheDocument();
    expect(screen.queryByText('Uptown Store')).not.toBeInTheDocument();
  });

  it('calls onSelectStore with the clicked open store', async () => {
    const onSelectStore = vi.fn();
    const target = store({ id: 2, name: 'Uptown Store' });
    render(
      <StorePicker
        user={USER}
        stores={[target]}
        onSelectStore={onSelectStore}
        onReload={vi.fn()}
        onLogout={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByText('Uptown Store'));

    expect(onSelectStore).toHaveBeenCalledWith(target);
  });
});
