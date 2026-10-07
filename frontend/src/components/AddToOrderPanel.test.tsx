import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AddToOrderPanel, { type ActiveItemNeed, type OrderableInventoryItem } from './AddToOrderPanel';
import type { Supplier } from '../types/supplier';

// Deterministic Mon-Thu / Sat-Sun anchors for the minimum-quantity tests
// below, found by walking forward from a fixed date rather than hardcoding
// one whose day-of-week has to be remembered correctly.
function nextWeekday(): Date {
  const date = new Date('2026-01-01T12:00:00Z');
  while (date.getDay() === 0 || date.getDay() === 6) date.setDate(date.getDate() + 1);
  return date;
}

function nextWeekendDay(): Date {
  const date = new Date('2026-01-01T12:00:00Z');
  while (date.getDay() !== 6) date.setDate(date.getDate() + 1);
  return date;
}

afterEach(() => {
  vi.useRealTimers();
});

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

  it('defaults "Other item" category to a "Select category" placeholder and submits a chosen category when picked', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    expect(screen.getByLabelText('Category')).toHaveTextContent('Select category');

    await user.click(screen.getByLabelText('Category'));
    expect(screen.getByRole('option', { name: 'No category' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Supplies' }));
    await user.type(screen.getByLabelText('Item name'), 'Napkins');
    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: 'SUPPLIES' }));
  });

  it('shows "No category" once deliberately picked, distinct from the untouched placeholder', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    await user.click(screen.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: 'No category' }));

    expect(screen.getByLabelText('Category')).toHaveTextContent('No category');

    await user.type(screen.getByLabelText('Item name'), 'Napkins');
    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: null }));
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
    // Checking the box reveals the Store Parity section's own Weekday/Weekend
    // Min steppers, so there are now three "Increase" buttons -- Quantity's
    // is the last one, rendered after that section in the form.
    const increaseButtons = screen.getAllByLabelText('Increase');
    await user.click(increaseButtons[increaseButtons.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ saveToInventory: true }));
  });

  it('only shows Store Parity & Minimum Quantities once "Also add to inventory" is checked', async () => {
    const user = userEvent.setup();
    renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    expect(screen.queryByText('Store Parity & Minimum Quantities')).not.toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    expect(screen.getByText('Store Parity & Minimum Quantities')).toBeInTheDocument();
    expect(screen.getByLabelText('Weekday Min Mon-Thu')).toBeInTheDocument();
    expect(screen.getByLabelText('Weekend Min Fri-Sun')).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox'));
    expect(screen.queryByText('Store Parity & Minimum Quantities')).not.toBeInTheDocument();
  });

  it('submits the chosen Weekday/Weekend Min when "Also add to inventory" is checked', async () => {
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    await user.type(screen.getByLabelText('Item name'), 'Napkins');
    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByRole('checkbox'));

    const weekdayStepper = screen.getByLabelText('Weekday Min Mon-Thu').closest('.counter-stepper') as HTMLElement;
    await user.click(within(weekdayStepper).getByLabelText('Increase'));
    const weekendStepper = screen.getByLabelText('Weekend Min Fri-Sun').closest('.counter-stepper') as HTMLElement;
    await user.click(within(weekendStepper).getByLabelText('Increase'));

    const increaseButtons = screen.getAllByLabelText('Increase');
    await user.click(increaseButtons[increaseButtons.length - 1]);
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ minWeekday: '1', minWeekend: '1' }));
  });

  it('auto-fills Quantity to the weekday minimum as it rises, but still allows going higher', async () => {
    vi.setSystemTime(nextWeekday());
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    await user.type(screen.getByLabelText('Item name'), 'Ice cubes');
    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByRole('checkbox'));

    const weekdayStepper = screen.getByLabelText('Weekday Min Mon-Thu').closest('.counter-stepper') as HTMLElement;
    for (let i = 0; i < 5; i += 1) {
      await user.click(within(weekdayStepper).getByLabelText('Increase'));
    }

    // Quantity's own stepper is the last of the three "Increase" buttons now
    // visible -- one extra click on top of the auto-filled minimum.
    const increaseButtons = screen.getAllByLabelText('Increase');
    const quantityIncrease = increaseButtons[increaseButtons.length - 1];
    await user.click(quantityIncrease);
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ minWeekday: '5', quantityNeeded: '6' }));
  });

  it('uses the weekend minimum, not the weekday one, on a weekend day once both are set', async () => {
    vi.setSystemTime(nextWeekendDay());
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    await user.type(screen.getByLabelText('Item name'), 'Ice cubes');
    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByRole('checkbox'));

    const weekdayStepper = screen.getByLabelText('Weekday Min Mon-Thu').closest('.counter-stepper') as HTMLElement;
    for (let i = 0; i < 3; i += 1) {
      await user.click(within(weekdayStepper).getByLabelText('Increase'));
    }
    const weekendStepper = screen.getByLabelText('Weekend Min Fri-Sun').closest('.counter-stepper') as HTMLElement;
    for (let i = 0; i < 8; i += 1) {
      await user.click(within(weekendStepper).getByLabelText('Increase'));
    }

    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ quantityNeeded: '8' }));
  });

  it('falls back to the weekday minimum on a weekend day when Weekend Min is left blank', async () => {
    vi.setSystemTime(nextWeekendDay());
    const user = userEvent.setup();
    const onSubmit = renderPanel();

    await user.click(screen.getByRole('tab', { name: 'Other item' }));
    await user.type(screen.getByLabelText('Item name'), 'Ice cubes');
    await user.type(screen.getByLabelText('Unit'), 'packs');
    await user.click(screen.getByRole('checkbox'));

    const weekdayStepper = screen.getByLabelText('Weekday Min Mon-Thu').closest('.counter-stepper') as HTMLElement;
    for (let i = 0; i < 4; i += 1) {
      await user.click(within(weekdayStepper).getByLabelText('Increase'));
    }
    // Weekend Min stays at its default (blank).

    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ minWeekend: '', quantityNeeded: '4' }));
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
