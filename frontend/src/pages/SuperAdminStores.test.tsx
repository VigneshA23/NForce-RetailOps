import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SuperAdminStores from './SuperAdminStores';
import * as storesApi from '../api/superAdminStores';
import * as ownersApi from '../api/owners';
import type { SuperAdminStore } from '../types/superAdminStore';
import type { OwnerSummary } from '../types/owner';

vi.mock('../api/superAdminStores');
vi.mock('../api/owners');

function store(overrides: Partial<SuperAdminStore> = {}): SuperAdminStore {
  return {
    storeId: 1,
    storeCode: 1001,
    storeName: 'Downtown Store',
    storeLocation: 'Downtown, Austin TX',
    storeActive: true,
    ownerId: 5,
    ownerName: 'Jamie Rivera',
    ownerActive: true,
    ownerAccessActive: true,
    employeeCount: 3,
    taskCount: 7,
    ...overrides,
  };
}

function ownerSummary(overrides: Partial<OwnerSummary> = {}): OwnerSummary {
  return {
    ownerId: 9,
    adminCode: 'ADM-9',
    ownerName: 'Available Owner',
    ownerEmail: 'available@nforce.test',
    ownerActive: true,
    storeId: null,
    storeCode: null,
    storeName: null,
    storeLocation: null,
    storeActive: null,
    ...overrides,
  } as OwnerSummary;
}

// SuperAdminStoreTable renders the same store twice -- once in the desktop
// table, once in the mobile card list, toggled purely by CSS media query --
// so a bare screen query matching either copy's text/labels is ambiguous
// under jsdom (which doesn't evaluate media queries). Scope to the desktop
// table, matching what a desktop-viewport user interacts with.
function desktopScope() {
  return within(document.querySelector('.super-admin-store-table__desktop') as HTMLElement);
}

describe('SuperAdminStores cross-page owner sync', () => {
  it('notifies the parent to refresh owners data after a store rename', async () => {
    vi.mocked(storesApi.getAllStores).mockResolvedValue([store()]);
    vi.mocked(ownersApi.getOwners).mockResolvedValue([]);
    vi.mocked(storesApi.updateStore).mockResolvedValue(
      store({ storeName: 'Renamed Store', storeLocation: 'New Location' }),
    );
    const onOwnersDataStale = vi.fn();

    render(<SuperAdminStores onNavigateToChecklist={vi.fn()} onOwnersDataStale={onOwnersDataStale} />);

    await desktopScope().findByText('Downtown Store');
    await userEvent.click(desktopScope().getByRole('button', { name: /edit downtown store/i }));

    const nameInput = await screen.findByLabelText('Store Name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Renamed Store');

    await userEvent.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() => expect(onOwnersDataStale).toHaveBeenCalledTimes(1));
  });

  it('notifies the parent to refresh owners data after assigning an owner to a store', async () => {
    const unassignedStore = store({ ownerId: null, ownerName: null, ownerActive: null, ownerAccessActive: false });
    vi.mocked(storesApi.getAllStores).mockResolvedValue([unassignedStore]);
    vi.mocked(ownersApi.getOwners).mockResolvedValue([ownerSummary()]);
    vi.mocked(storesApi.assignStoreOwner).mockResolvedValue(
      store({ ownerId: 9, ownerName: 'Available Owner', ownerActive: true, ownerAccessActive: true }),
    );
    const onOwnersDataStale = vi.fn();

    render(<SuperAdminStores onNavigateToChecklist={vi.fn()} onOwnersDataStale={onOwnersDataStale} />);

    await desktopScope().findByText('Downtown Store');
    await userEvent.click(desktopScope().getByRole('button', { name: /assign owner to downtown store/i }));

    const select = await screen.findByLabelText('Select Owner');
    await userEvent.selectOptions(select, '9');
    await userEvent.click(screen.getByRole('button', { name: 'Assign Owner' }));

    await waitFor(() => expect(onOwnersDataStale).toHaveBeenCalledTimes(1));
  });
});
