import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import OrderListEntryEditModal from './OrderListEntryEditModal';
import type { OrderListEntry, OrderStatus } from '../types/orderList';

function entry(overrides: Partial<OrderListEntry>): OrderListEntry {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Milk',
    unitOfMeasurement: 'Gallons',
    quantityNeeded: 4,
    supplierId: null,
    supplierName: null,
    note: null,
    status: 'NEEDS_ORDERING',
    adHoc: false,
    raisedByName: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    imageId: null,
    ...overrides,
  };
}

async function openStatusDropdown(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Status' }));
  return screen.getByRole('listbox');
}

describe('OrderListEntryEditModal status transitions', () => {
  it('offers only the current status and the one legal next step from Needs Ordering', async () => {
    const user = userEvent.setup();
    render(
      <OrderListEntryEditModal
        isOpen
        entry={entry({ status: 'NEEDS_ORDERING' })}
        suppliers={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const listbox = await openStatusDropdown(user);
    const labels = within(listbox).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Needs Ordering', 'Ordered']);
  });

  it('offers only the current status and Received from Ordered, not Needs Ordering', async () => {
    const user = userEvent.setup();
    render(
      <OrderListEntryEditModal
        isOpen
        entry={entry({ status: 'ORDERED' })}
        suppliers={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const listbox = await openStatusDropdown(user);
    const labels = within(listbox).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Ordered', 'Received']);
  });

  it('offers no further transition once Received -- it is a terminal status', async () => {
    const user = userEvent.setup();
    render(
      <OrderListEntryEditModal
        isOpen
        entry={entry({ status: 'RECEIVED' })}
        suppliers={[]}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    const listbox = await openStatusDropdown(user);
    const labels = within(listbox).getAllByRole('option').map((o) => o.textContent);
    expect(labels).toEqual(['Received']);
  });

  it('submits the selected next status', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <OrderListEntryEditModal
        isOpen
        entry={entry({ status: 'NEEDS_ORDERING', quantityNeeded: 4 })}
        suppliers={[]}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    const listbox = await openStatusDropdown(user);
    await user.click(within(listbox).getByRole('option', { name: 'Ordered' }));
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ status: 'ORDERED' satisfies OrderStatus }));
  });
});
