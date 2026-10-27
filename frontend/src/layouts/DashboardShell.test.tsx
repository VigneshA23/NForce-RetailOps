import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import DashboardShell from './DashboardShell';
import type { AuthUser } from '../types/auth';

// AppShell is replaced with a probe so the test only checks which profile-menu
// handlers the shell hands down, not the whole page tree.
vi.mock('./AppShell', () => ({
  default: (props: { onInventoryClick?: () => void; onOrdersClick?: () => void; onIssuesClick?: () => void }) => (
    <div>
      <span data-testid="inventory-item">{props.onInventoryClick ? 'yes' : 'no'}</span>
      <span data-testid="orders-item">{props.onOrdersClick ? 'yes' : 'no'}</span>
      <span data-testid="issues-item">{props.onIssuesClick ? 'yes' : 'no'}</span>
    </div>
  ),
}));

vi.mock('../hooks/useOwnerStores', () => ({ useOwnerStores: () => ({ stores: [], isLoading: false }) }));
vi.mock('../hooks/useOwnerCategories', () => ({ useOwnerCategories: () => ({ categories: [], isLoading: false }) }));
vi.mock('../hooks/useOwnerEmployees', () => ({ useOwnerEmployees: () => ({ employees: [], isLoading: false }) }));
vi.mock('../hooks/useUnreadCount', () => ({ useUnreadCount: () => ({ count: 0, setCount: vi.fn() }) }));

const user = { fullName: 'Test Owner' } as AuthUser;

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
    render(<DashboardShell user={user} onLogout={() => {}} />);

    expect(screen.getByTestId('inventory-item')).toHaveTextContent('no');
    expect(screen.getByTestId('orders-item')).toHaveTextContent('no');
    // Issues is unchanged.
    expect(screen.getByTestId('issues-item')).toHaveTextContent('yes');
  });

  it('keeps Inventory and Orders in the profile menu on mobile, where the bottom bar has no room', () => {
    mockViewport(true);
    render(<DashboardShell user={user} onLogout={() => {}} />);

    expect(screen.getByTestId('inventory-item')).toHaveTextContent('yes');
    expect(screen.getByTestId('orders-item')).toHaveTextContent('yes');
  });
});
