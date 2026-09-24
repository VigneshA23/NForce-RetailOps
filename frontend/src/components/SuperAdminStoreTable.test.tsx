import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SuperAdminStoreTable from './SuperAdminStoreTable';
import type { SuperAdminStore } from '../types/superAdminStore';

function baseStore(overrides: Partial<SuperAdminStore> = {}): SuperAdminStore {
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

function renderTable(stores: SuperAdminStore[], props: Partial<Parameters<typeof SuperAdminStoreTable>[0]> = {}) {
  return render(
    <SuperAdminStoreTable stores={stores} onViewDetails={vi.fn()} onToggleStatus={vi.fn()} onEdit={vi.fn()} onAssignOwner={vi.fn()} onDelete={vi.fn()} {...props} />,
  );
}

// The component renders the same data twice -- once in the desktop table,
// once in the mobile card list, toggled purely by CSS media query -- so any
// query matching either copy's text/labels is ambiguous under jsdom (which
// doesn't evaluate media queries). Scope interaction/assertion queries to the
// desktop table specifically, matching what a desktop-viewport user sees.
function desktopScope() {
  return within(document.querySelector('.super-admin-store-table__desktop') as HTMLElement);
}

function mobileScope() {
  return within(document.querySelector('.super-admin-store-table__mobile-cards') as HTMLElement);
}

describe('SuperAdminStoreTable', () => {
  it('shows the owner name when the store has active owner access', () => {
    renderTable([baseStore({ ownerName: 'Jamie Rivera', ownerAccessActive: true })]);

    expect(desktopScope().getByText('Jamie Rivera')).toBeInTheDocument();
    expect(desktopScope().queryByText('Unassigned')).not.toBeInTheDocument();
  });

  it('shows "Unassigned" when the store has no owner at all', () => {
    renderTable([baseStore({ ownerId: null, ownerName: null, ownerActive: null, ownerAccessActive: false })]);

    expect(desktopScope().getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows "Unassigned" when an owner is assigned but their access was revoked', () => {
    renderTable([baseStore({ ownerName: 'Jamie Rivera', ownerAccessActive: false })]);

    expect(desktopScope().getByText('Unassigned')).toBeInTheDocument();
    expect(desktopScope().queryByText('Jamie Rivera')).not.toBeInTheDocument();
  });

  it("renders the status toggle checked for an active store, unaffected by owner access", () => {
    renderTable([baseStore({ storeActive: true, ownerAccessActive: false })]);

    const toggle = desktopScope().getByLabelText('Deactivate Downtown Store');
    expect(toggle).toBeChecked();
  });

  it('renders the status toggle unchecked for an inactive store', () => {
    renderTable([baseStore({ storeActive: false })]);

    expect(desktopScope().getByLabelText('Activate Downtown Store')).not.toBeChecked();
  });

  it('calls onToggleStatus when the row status switch is clicked', async () => {
    const onToggleStatus = vi.fn();
    const store = baseStore({ storeActive: true });
    renderTable([store], { onToggleStatus });

    await userEvent.click(desktopScope().getByLabelText('Deactivate Downtown Store'));

    expect(onToggleStatus).toHaveBeenCalledWith(store);
  });

  it('calls onViewDetails when the store name is clicked', async () => {
    const onViewDetails = vi.fn();
    const store = baseStore();
    renderTable([store], { onViewDetails });

    await userEvent.click(desktopScope().getByRole('button', { name: /view downtown store/i }));

    expect(onViewDetails).toHaveBeenCalledWith(store);
  });

  it('calls onEdit when the edit action is clicked', async () => {
    const onEdit = vi.fn();
    const store = baseStore();
    renderTable([store], { onEdit });

    await userEvent.click(desktopScope().getByRole('button', { name: /edit downtown store/i }));

    expect(onEdit).toHaveBeenCalledWith(store);
  });

  it('shows the staff count pill on the mobile card', () => {
    renderTable([baseStore({ employeeCount: 4 })]);

    expect(mobileScope().getByText('4 Staff Members')).toBeInTheDocument();
  });

  it('shows the owner placeholder icon and "Unassigned" on the mobile card when there is no owner', () => {
    renderTable([baseStore({ ownerId: null, ownerName: null, ownerActive: null, ownerAccessActive: false })]);

    expect(mobileScope().getByText('Unassigned')).toBeInTheDocument();
  });

  it('renders the supplied empty message when there are no rows', () => {
    renderTable([], { emptyMessage: 'No stores match your filters.' });

    expect(screen.getByText('No stores match your filters.')).toBeInTheDocument();
  });

  it('shows the loading message instead of the empty message while loading', () => {
    renderTable([], { isLoading: true, emptyMessage: 'No stores match your filters.' });

    expect(screen.getByText('Loading stores...')).toBeInTheDocument();
    expect(screen.queryByText('No stores match your filters.')).not.toBeInTheDocument();
  });
});
