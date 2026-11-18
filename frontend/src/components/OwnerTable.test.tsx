import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import OwnerTable, { groupOwners } from './OwnerTable';
import AssignStoreModal from './AssignStoreModal';
import type { OwnerSummary } from '../types/owner';

vi.mock('../api/owners', () => ({
  getNextStoreCode: vi.fn().mockResolvedValue(1001),
  getReassignableStores: vi.fn().mockResolvedValue([]),
}));

function row(overrides: Partial<OwnerSummary>): OwnerSummary {
  return {
    ownerId: 1,
    adminCode: 'ADM-001',
    ownerName: 'Priya Admin',
    ownerEmail: 'priya@nforce.test',
    ownerActive: true,
    avatarUrl: null,
    storeId: null,
    storeCode: null,
    storeName: null,
    storeLocation: null,
    storeActive: null,
    ...overrides,
  };
}

const north = row({ storeId: 11, storeCode: 501, storeName: 'North', storeActive: true });
const south = row({ storeId: 12, storeCode: 502, storeName: 'South', storeActive: true });

function renderTable(owners: OwnerSummary[], handlers: Partial<Parameters<typeof OwnerTable>[0]> = {}) {
  return render(
    <OwnerTable
      owners={owners}
      onEdit={() => {}}
      onToggleStatus={() => {}}
      onDelete={() => {}}
      onAddStore={() => {}}
      onView={() => {}}
      {...handlers}
    />,
  );
}

describe('groupOwners', () => {
  it('keeps every store an admin holds', () => {
    const [owner] = groupOwners([north, south]);
    expect(owner.activeStores.map((s) => s.storeName)).toEqual(['North', 'South']);
    expect(owner.activeStore?.storeName).toBe('North');
  });
});

describe('OwnerTable store assignment', () => {
  it('lists every store an admin holds, read-only (no remove control in the table)', () => {
    renderTable([north, south]);

    const desktop = screen.getAllByRole('table')[0];
    expect(within(desktop).getByText('North')).toBeInTheDocument();
    expect(within(desktop).getByText('South')).toBeInTheDocument();
    expect(within(desktop).queryByRole('button', { name: /remove/i })).not.toBeInTheDocument();
  });

  it('still offers Add Store to an active admin who already has a store', () => {
    const onAddStore = vi.fn();
    renderTable([north], { onAddStore });

    const desktop = screen.getAllByRole('table')[0];
    fireEvent.click(within(desktop).getByRole('button', { name: 'Add store for Priya Admin' }));
    expect(onAddStore).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 1 }));
  });

  it('shows "No store assigned" for an active admin with no stores', () => {
    renderTable([row({})]);
    expect(within(screen.getAllByRole('table')[0]).getByText('No store assigned')).toBeInTheDocument();
  });
});

describe('AssignStoreModal', () => {
  it('shows a rejected assignment (409) inline', async () => {
    render(
      <AssignStoreModal
        isOpen
        ownerName="Priya Admin"
        errorMessage="An admin is already assigned to this store"
        onClose={() => {}}
        onSubmit={() => {}}
      />,
    );
    expect(await screen.findByText('An admin is already assigned to this store')).toBeInTheDocument();
  });
});
