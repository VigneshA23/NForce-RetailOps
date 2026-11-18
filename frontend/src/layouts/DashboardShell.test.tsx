import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardShell from './DashboardShell';
import type { AuthUser } from '../types/auth';
import type { StoreSummary } from '../types/store';

// AppShell is replaced with a probe so the test only checks which profile-menu
// handlers the shell hands down, not the whole page tree.
vi.mock('./AppShell', () => ({
  default: (props: {
    onInventoryClick?: () => void;
    onOrdersClick?: () => void;
    onIssuesClick?: () => void;
    onSwitchStore?: () => void;
    subtitle?: string;
    headerActions?: ReactNode;
  }) => (
    <div>
      <span data-testid="inventory-item">{props.onInventoryClick ? 'yes' : 'no'}</span>
      <span data-testid="orders-item">{props.onOrdersClick ? 'yes' : 'no'}</span>
      <span data-testid="issues-item">{props.onIssuesClick ? 'yes' : 'no'}</span>
      <span data-testid="switch-store-item">{props.onSwitchStore ? 'yes' : 'no'}</span>
      <span data-testid="subtitle">{props.subtitle}</span>
      <div data-testid="header-actions">{props.headerActions}</div>
    </div>
  ),
}));

vi.mock('../hooks/useOwnerStores', () => ({ useOwnerStores: () => ({ stores: [], isLoading: false }) }));
vi.mock('../hooks/useOwnerCategories', () => ({ useOwnerCategories: () => ({ categories: [], isLoading: false }) }));
vi.mock('../hooks/useOwnerEmployees', () => ({ useOwnerEmployees: () => ({ employees: [], isLoading: false }) }));
vi.mock('../components/AdminSearchDropdown', () => ({ default: () => null }));
vi.mock('../hooks/useUnreadCount', () => ({ useUnreadCount: () => ({ count: 0, setCount: vi.fn() }) }));

const user = { fullName: 'Test Owner' } as AuthUser;
const northStore: StoreSummary = { id: 1, name: 'North', location: null, status: 'Open' };
const southStore: StoreSummary = { id: 2, name: 'South', location: null, status: 'Open' };
const storeProps = { store: northStore, stores: [northStore], onSwitchStore: () => {} };

function mockViewport(isMobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isMobile && query.includes('max-width: 480px'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

describe('DashboardShell profile menu entries', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('does not offer Inventory or Orders in the profile menu on desktop and tablet', () => {
    mockViewport(false);
    render(<DashboardShell user={user} onLogout={() => {}} {...storeProps} />);

    expect(screen.getByTestId('inventory-item')).toHaveTextContent('no');
    expect(screen.getByTestId('orders-item')).toHaveTextContent('no');
    // Issues is unchanged.
    expect(screen.getByTestId('issues-item')).toHaveTextContent('yes');
  });

  it('keeps Inventory and Orders in the profile menu on mobile, where the bottom bar has no room', () => {
    mockViewport(true);
    render(<DashboardShell user={user} onLogout={() => {}} {...storeProps} />);

    expect(screen.getByTestId('inventory-item')).toHaveTextContent('yes');
    expect(screen.getByTestId('orders-item')).toHaveTextContent('yes');
  });
});

describe('DashboardShell store switching', () => {
  beforeEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
    mockViewport(false);
  });

  it('shows the selected store and no Switch Store action for an admin with one store', () => {
    render(<DashboardShell user={user} onLogout={() => {}} store={northStore} stores={[northStore]} onSwitchStore={() => {}} />);

    expect(screen.getByTestId('subtitle')).toHaveTextContent('North');
    expect(screen.getByTestId('switch-store-item')).toHaveTextContent('no');
    expect(screen.queryByRole('button', { name: 'Switch Store' })).not.toBeInTheDocument();
  });

  it('offers Switch Store to an admin with several stores', () => {
    const onSwitchStore = vi.fn();
    render(
      <DashboardShell
        user={user}
        onLogout={() => {}}
        store={southStore}
        stores={[northStore, southStore]}
        onSwitchStore={onSwitchStore}
      />,
    );

    expect(screen.getByTestId('subtitle')).toHaveTextContent('South');
    expect(screen.getByTestId('switch-store-item')).toHaveTextContent('yes');
    fireEvent.click(screen.getByRole('button', { name: 'Switch Store' }));
    expect(onSwitchStore).toHaveBeenCalledTimes(1);
  });
});
