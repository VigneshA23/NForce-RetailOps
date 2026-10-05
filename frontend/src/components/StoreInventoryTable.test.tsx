import { render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StoreInventoryTable from './StoreInventoryTable';
import type { StoreInventoryItem } from '../types/storeInventory';

function item(overrides: Partial<StoreInventoryItem>): StoreInventoryItem {
  return {
    id: 1,
    storeId: 1,
    storeName: 'Store 1',
    name: 'Milk',
    category: null,
    unitOfMeasurement: 'L',
    minWeekday: 8,
    minWeekend: 12,
    preferredSupplierId: null,
    preferredSupplierName: null,
    note: null,
    active: true,
    autoPoEnabled: true,
    requiredToday: 8,
    currentAvailable: 3,
    ...overrides,
  };
}

function cell(rowName: RegExp, label: string) {
  return within(screen.getByRole('row', { name: rowName }))
    .getAllByRole('cell')
    .find((c) => c.dataset.label === label);
}

function renderTable(items: StoreInventoryItem[]) {
  render(
    <StoreInventoryTable items={items} showStore={false} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />,
  );
}

describe('StoreInventoryTable', () => {
  it("shows today's required minimum and today's counted stock as two columns", () => {
    renderTable([item({})]);

    expect(screen.getByRole('columnheader', { name: 'Required Today' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Current Available' })).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /Weekday|Weekend/ })).not.toBeInTheDocument();

    expect(cell(/Milk/, 'Required Today')).toHaveTextContent('8');
    expect(cell(/Milk/, 'Current Available')).toHaveTextContent('3');
  });

  it('says the item has not been counted when there is no stock check today', () => {
    renderTable([item({ currentAvailable: null })]);

    expect(cell(/Milk/, 'Current Available')).toHaveTextContent('Not counted yet');
  });

  it('shows a zero count as 0, not as uncounted', () => {
    renderTable([item({ currentAvailable: 0 })]);

    expect(cell(/Milk/, 'Current Available')).toHaveTextContent('0');
  });
});
