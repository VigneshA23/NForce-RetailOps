import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AddToOrderPanel, { type ActiveItemNeed, type OrderableInventoryItem } from './AddToOrderPanel';
import type { Supplier } from '../types/supplier';

const ITEMS: OrderableInventoryItem[] = [
  { id: 1, name: 'Milk', unitOfMeasurement: 'L', preferredSupplierId: 9 },
  { id: 2, name: 'Bread', unitOfMeasurement: 'loaves', preferredSupplierId: null },
];
const SUPPLIERS: Supplier[] = [
  { id: 9, name: 'Acme Supplies', active: true },
  { id: 10, name: 'Fresh Foods', active: true },
];

function renderPanel(onSubmit = vi.fn(), activeNeedByItemId?: Map<number, ActiveItemNeed>) {
  render(
    <AddToOrderPanel
      isOpen
      storeName="Downtown"
      inventoryItems={ITEMS}
      suppliers={SUPPLIERS}
      activeNeedByItemId={activeNeedByItemId}
      onClose={vi.fn()}
      onSubmit={onSubmit}
    />,
  );
  return onSubmit;
}

async function selectItem(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByLabelText('Item'));
  await user.click(screen.getByRole('option', { name: label }));
}

describe('AddToOrderPanel', () => {
  it('defaults to "From inventory" with no item pre-selected', () => {
    renderPanel();

    expect(screen.getByRole('tab', { name: 'From inventory' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByLabelText('Item')).toHaveTextContent('Select an item');
  });

  it('requires choosing an item before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Choose an item')).toBeInTheDocument();
  });

  it('does not show a Supplier field for "From inventory"', async () => {
    const user = userEvent.setup();
    renderPanel();

    await selectItem(user, 'Milk');

    expect(screen.queryByLabelText('Supplier')).not.toBeInTheDocument();
  });

  it('submits the from-inventory shape, using the item\'s preferred supplier automatically', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await selectItem(user, 'Milk');
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      storeInventoryItemId: 1,
      quantityNeeded: '1',
      supplierId: 9,
    }));
  });

  it('shows what the item already needs once one with an active entry is selected', async () => {
    const user = userEvent.setup();
    renderPanel(vi.fn(), new Map([[1, { quantityNeeded: 3, manualAddition: 2 }]]));

    expect(screen.queryByText(/Already needs/)).not.toBeInTheDocument();

    await selectItem(user, 'Milk');

    expect(screen.getByText(/Already needs/)).toHaveTextContent('Already needs 5 L');
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
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      storeInventoryItemId: null,
      itemName: 'Birthday candles',
      unitOfMeasurement: 'packs',
      category: null,
      saveToInventory: false,
    }));
  });

  it('defaults "Other item" category to "No category" and submits a chosen category when picked', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    expect(screen.getByLabelText('Category')).toHaveTextContent('No category');

    await user.click(screen.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: 'Supplies' }));
    await user.type(screen.getByLabelText('Item name'), 'Napkins');
    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: 'SUPPLIES' }));
  });

  it('shows a Supplier field for "Other item"', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));

    expect(screen.getByLabelText('Supplier')).toBeInTheDocument();
  });

  it('submits saveToInventory true when the checkbox is checked', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    await user.type(screen.getByLabelText('Item name'), 'Napkins');
    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ saveToInventory: true }));
  });

  it('defaults quantity to 0 and increments/decrements via the stepper buttons', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await selectItem(user, 'Milk');
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByLabelText('Decrease'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ quantityNeeded: '1' }));
  });
});
