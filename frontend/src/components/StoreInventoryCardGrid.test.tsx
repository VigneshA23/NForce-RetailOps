import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StoreInventoryCardGrid from './StoreInventoryCardGrid';
import type { StoreInventoryItem } from '../types/storeInventory';

function item(overrides: Partial<StoreInventoryItem>): StoreInventoryItem {
  return {
    id: 1,
    storeId: 1,
    storeName: 'Store 1',
    category: 'DAIRY',
    name: 'Milk',
    unitOfMeasurement: 'L',
    minWeekday: 8,
    minWeekend: 12,
    preferredSupplierId: null,
    preferredSupplierName: 'Walmart',
    note: null,
    active: true,
    autoPoEnabled: true,
    requiredToday: 8,
    currentAvailable: 3,
    imageId: null,
    ...overrides,
  };
}

describe('StoreInventoryCardGrid', () => {
  it('shows an empty state when there are no items', () => {
    render(<StoreInventoryCardGrid items={[]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(screen.getByText('No inventory items match your filters.')).toBeInTheDocument();
  });

  it('shows a loading state', () => {
    render(<StoreInventoryCardGrid items={[]} isLoading onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(screen.getByText('Loading inventory...')).toBeInTheDocument();
  });

  it('badges an active item below its minimum as Low Stock', () => {
    render(<StoreInventoryCardGrid items={[item({})]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(screen.getByText('Low Stock')).toBeInTheDocument();
  });

  it('badges an uncounted active item as Out of Stock', () => {
    render(<StoreInventoryCardGrid items={[item({ currentAvailable: null })]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });

  it('badges an item at or above its minimum as In Stock', () => {
    render(<StoreInventoryCardGrid items={[item({ currentAvailable: 10 })]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(screen.getByText('In Stock')).toBeInTheDocument();
  });

  it('badges a deactivated item as Inactive regardless of stock', () => {
    render(<StoreInventoryCardGrid items={[item({ active: false, currentAvailable: 10 })]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('shows the category badge and supplier name', () => {
    render(<StoreInventoryCardGrid items={[item({})]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(screen.getByText('Dairy')).toBeInTheDocument();
    expect(screen.getByText('Walmart')).toBeInTheDocument();
  });

  it('opens the edit panel by clicking the card itself, not a dedicated icon', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    render(<StoreInventoryCardGrid items={[item({})]} onEdit={onEdit} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Edit Milk' }));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });

  it('deletes via the trash icon without opening the edit panel', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    render(<StoreInventoryCardGrid items={[item({})]} onEdit={onEdit} onDelete={onDelete} onToggleStatus={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Delete Milk' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('toggles status without opening the edit panel', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();
    const onToggleStatus = vi.fn();
    render(<StoreInventoryCardGrid items={[item({})]} onEdit={onEdit} onDelete={vi.fn()} onToggleStatus={onToggleStatus} />);

    await user.click(screen.getByRole('switch', { name: 'Deactivate Milk' }));
    expect(onToggleStatus).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }), false);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('marks the card matching selectedId as selected, and no others', () => {
    render(
      <StoreInventoryCardGrid
        items={[item({ id: 1, name: 'Milk' }), item({ id: 2, name: 'Bread' })]}
        selectedId={2}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onToggleStatus={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Edit Milk' })).not.toHaveClass('store-inventory-card--selected');
    expect(screen.getByRole('button', { name: 'Edit Bread' })).toHaveClass('store-inventory-card--selected');
  });

  it('selects no card when selectedId is not provided', () => {
    render(<StoreInventoryCardGrid items={[item({})]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Edit Milk' })).not.toHaveClass('store-inventory-card--selected');
  });
});
