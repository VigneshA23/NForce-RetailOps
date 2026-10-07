import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import AddToOrderPanel, { type ActiveItemNeed, type OrderableInventoryItem } from './AddToOrderPanel';

const ITEMS: OrderableInventoryItem[] = [
  { id: 1, name: 'Milk', unitOfMeasurement: 'L', preferredSupplierId: 9 },
  { id: 2, name: 'Bread', unitOfMeasurement: 'loaves', preferredSupplierId: null },
];

function renderPanel(onSubmit = vi.fn(), activeNeedByItemId?: Map<number, ActiveItemNeed>) {
  render(
    <AddToOrderPanel
      isOpen
      storeName="Downtown"
      inventoryItems={ITEMS}
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
  it('shows the item picker with no item pre-selected', () => {
    renderPanel();

    expect(screen.getByLabelText('Item')).toHaveTextContent('Select an item');
  });

  it('requires choosing an item before submitting', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Choose an item')).toBeInTheDocument();
  });

  it('does not show a Supplier field', async () => {
    const user = userEvent.setup();
    renderPanel();

    await selectItem(user, 'Milk');

    expect(screen.queryByLabelText('Supplier')).not.toBeInTheDocument();
  });

  it('submits using the item\'s preferred supplier automatically', async () => {
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

  it('submits null supplierId for an item with no preferred supplier', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await selectItem(user, 'Bread');
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ storeInventoryItemId: 2, supplierId: null }));
  });

  it('shows what the item already needs once one with an active entry is selected', async () => {
    const user = userEvent.setup();
    renderPanel(vi.fn(), new Map([[1, { quantityNeeded: 3, manualAddition: 2 }]]));

    expect(screen.queryByText(/Already needs/)).not.toBeInTheDocument();

    await selectItem(user, 'Milk');

    expect(screen.getByText(/Already needs/)).toHaveTextContent('Already needs 5 L');
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

  it('submits an entered note', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await selectItem(user, 'Milk');
    await user.click(screen.getByLabelText('Increase'));
    await user.type(screen.getByLabelText('Note (optional)'), 'Saturday event');
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ note: 'Saturday event' }));
  });

  it('shows "No inventory items yet" when there is nothing to pick', () => {
    render(
      <AddToOrderPanel isOpen storeName="Downtown" inventoryItems={[]} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByLabelText('Item')).toHaveTextContent('No inventory items yet');
    expect(screen.getByLabelText('Item')).toBeDisabled();
  });
});
