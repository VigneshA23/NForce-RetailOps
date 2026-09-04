import { render, screen } from '@testing-library/react';
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
    <SuperAdminStoreTable stores={stores} onViewDetails={vi.fn()} onToggleStatus={vi.fn()} {...props} />,
  );
}

describe('SuperAdminStoreTable', () => {
  it('shows the owner name when the store has active owner access', () => {
    renderTable([baseStore({ ownerName: 'Jamie Rivera', ownerAccessActive: true })]);

    expect(screen.getByText('Jamie Rivera')).toBeInTheDocument();
    expect(screen.queryByText('Unassigned')).not.toBeInTheDocument();
  });

  it('shows "Unassigned" when the store has no owner at all', () => {
    renderTable([baseStore({ ownerId: null, ownerName: null, ownerActive: null, ownerAccessActive: false })]);

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
  });

  it('shows "Unassigned" when an owner is assigned but their access was revoked', () => {
    renderTable([baseStore({ ownerName: 'Jamie Rivera', ownerAccessActive: false })]);

    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.queryByText('Jamie Rivera')).not.toBeInTheDocument();
  });

  it("renders the status toggle checked for an active store, unaffected by owner access", () => {
    renderTable([baseStore({ storeActive: true, ownerAccessActive: false })]);

    const toggle = screen.getByLabelText('Deactivate Downtown Store');
    expect(toggle).toBeChecked();
  });

  it('renders the status toggle unchecked for an inactive store', () => {
    renderTable([baseStore({ storeActive: false })]);

    expect(screen.getByLabelText('Activate Downtown Store')).not.toBeChecked();
  });

  it('calls onToggleStatus when the row status switch is clicked', async () => {
    const onToggleStatus = vi.fn();
    const store = baseStore({ storeActive: true });
    renderTable([store], { onToggleStatus });

    await userEvent.click(screen.getByLabelText('Deactivate Downtown Store'));

    expect(onToggleStatus).toHaveBeenCalledWith(store);
  });

  it('calls onViewDetails when the store name is clicked', async () => {
    const onViewDetails = vi.fn();
    const store = baseStore();
    renderTable([store], { onViewDetails });

    await userEvent.click(screen.getByRole('button', { name: /view downtown store/i }));

    expect(onViewDetails).toHaveBeenCalledWith(store);
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
