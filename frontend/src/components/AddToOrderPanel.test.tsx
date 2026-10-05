import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AddToOrderPanel, { type OrderableInventoryItem } from './AddToOrderPanel';
import type { Supplier } from '../types/supplier';

const ITEMS: OrderableInventoryItem[] = [
  { id: 1, name: 'Milk', unitOfMeasurement: 'L', preferredSupplierId: 9 },
  { id: 2, name: 'Bread', unitOfMeasurement: 'loaves', preferredSupplierId: null },
];
const SUPPLIERS: Supplier[] = [
  { id: 9, name: 'Acme Supplies', active: true },
  { id: 10, name: 'Fresh Foods', active: true },
];

function renderPanel(onSubmit = vi.fn()) {
  render(
    <AddToOrderPanel
      isOpen
      storeName="Downtown"
      inventoryItems={ITEMS}
      suppliers={SUPPLIERS}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

describe('AddToOrderPanel', () => {
  it('defaults to "From inventory" with the first item selected', () => {
    renderPanel();

    expect(screen.getByRole('tab', { name: 'From inventory' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Item')).toBeInTheDocument();
  });

  it('submits the from-inventory shape, falling back to the item\'s preferred supplier', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      storeInventoryItemId: 1,
      quantityNeeded: '1',
      supplierId: 9,
    }));
  });

  it('switches to "Other item" and requires a name and unit before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Enter an item name to continue')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Item name'), 'Birthday candles');
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));
    expect(screen.getByText('Enter a unit to continue')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      storeInventoryItemId: null,
      itemName: 'Birthday candles',
      unitOfMeasurement: 'packs',
      category: 'INGREDIENTS',
      saveToInventory: false,
    }));
  });

  it('submits saveToInventory true when the checkbox is checked', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    await user.type(screen.getByLabelText('Item name'), 'Napkins');
    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ saveToInventory: true }));
  });

  it('increments and decrements quantity via the stepper buttons', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByLabelText('Decrease'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ quantityNeeded: '2' }));
  });
});
