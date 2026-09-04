import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SuperAdminDashboard from './SuperAdminDashboard';
import type { OwnerSummary } from '../types/owner';
import type { AuthUser } from '../types/auth';
import * as ownersApi from '../api/owners';

vi.mock('../api/owners');

const USER: AuthUser = { token: 'token', role: 'SUPER_ADMIN', fullName: 'Super Admin' };

function ownerWithoutStore(overrides: Partial<OwnerSummary> = {}): OwnerSummary {
  return {
    ownerId: 1,
    ownerName: 'Priya Owner',
    ownerEmail: 'priya@example.com',
    ownerActive: true,
    storeId: null,
    storeCode: null,
    storeName: null,
    storeLocation: null,
    storeActive: null,
    ...overrides,
  };
}

// Proves the fix for the stale-list bug on the Super Admin side: assigning a
// store to an owner can move that store away from a different (previously
// revoked) owner, so the owner list must be re-fetched afterward -- exactly
// like the existing "Add Owner" flow already does -- instead of only
// appending the single row the assign-store call itself returned.
describe('SuperAdminDashboard assign-store refresh', () => {
  beforeEach(() => {
    vi.mocked(ownersApi.getNextStoreCode).mockResolvedValue(101);
  });

  it('re-fetches the owner list after successfully assigning a store', async () => {
    const owner = ownerWithoutStore();
    vi.mocked(ownersApi.getOwners).mockResolvedValue([owner]);
    vi.mocked(ownersApi.assignStore).mockResolvedValue({
      ...owner,
      storeId: 10,
      storeCode: 101,
      storeName: 'Downtown Store',
      storeLocation: 'Downtown',
      storeActive: true,
    });

    render(<SuperAdminDashboard user={USER} onLogout={vi.fn()} />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add Store' }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText('Store Name'), 'Downtown Store');
    await userEvent.type(within(dialog).getByLabelText('Store Location'), 'Downtown');

    expect(ownersApi.getOwners).toHaveBeenCalledTimes(1);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Add Store' }));

    expect(ownersApi.assignStore).toHaveBeenCalledWith(owner.ownerId, {
      storeName: 'Downtown Store',
      storeLocation: 'Downtown',
    });
    // Reloaded (a second getOwners call), not just appended locally.
    expect(ownersApi.getOwners).toHaveBeenCalledTimes(2);
  });
});
