import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReceivedStockModal from './ReceivedStockModal';
import type { OpenOrder } from '../types/stockCheck';

const orders: OpenOrder[] = [
  { id: 74, quantity: 4, supplierName: null, orderedAt: null },
  { id: 77, quantity: 6, supplierName: 'Dairy Co', orderedAt: null },
];

function renderEndOfDay(props: { alreadyReceived?: number; orders?: OpenOrder[]; deadStock?: number } = {}) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ReceivedStockModal
      isOpen
      itemName="Milk"
      unit="L"
      startUsable={10}
      endUsable={20}
      deadStock={props.deadStock ?? 0}
      alreadyReceived={props.alreadyReceived ?? 0}
      orders={props.orders ?? orders}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

async function submit() {
  await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
}

describe('ReceivedStockModal at End of Day', () => {
  it('lists the orders as details with no checkboxes or new-stock option', () => {
    renderEndOfDay();
    expect(screen.getByText(/Order #74 · 4 L/)).toBeInTheDocument();
    expect(screen.getByText(/Order #77 · 6 L · Dairy Co/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/New stock/)).not.toBeInTheDocument();
  });

  it('asks for the current stock, prefilled with the count entered', () => {
    renderEndOfDay();
    expect(screen.getByLabelText(/Current on-hand stock/)).toHaveValue('20');
  });

  it('prefills the typed total without adding the dead stock again', () => {
    renderEndOfDay({ deadStock: 3 });
    expect(screen.getByLabelText(/Current on-hand stock/)).toHaveValue('20');
  });

  it('confirms every order together with the current stock given', async () => {
    const { onConfirm } = renderEndOfDay();
    const box = screen.getByLabelText(/Current on-hand stock/);
    await userEvent.clear(box);
    await userEvent.type(box, '18');
    await submit();
    expect(onConfirm).toHaveBeenCalledWith(
      [{ orderId: 74, quantity: 4 }, { orderId: 77, quantity: 6 }],
      18,
    );
  });

  it('refuses a current stock the orders cannot explain', async () => {
    const { onConfirm } = renderEndOfDay();
    const box = screen.getByLabelText(/Current on-hand stock/);
    await userEvent.clear(box);
    await userEvent.type(box, '21');
    await submit();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Current stock cannot be more than 20/)).toBeInTheDocument();
  });

  it('counts stock already received towards the limit', async () => {
    const { onConfirm } = renderEndOfDay({ alreadyReceived: 3 });
    const box = screen.getByLabelText(/Current on-hand stock/);
    await userEvent.clear(box);
    await userEvent.type(box, '23');
    await submit();
    expect(onConfirm).toHaveBeenCalledWith(expect.any(Array), 23);
  });

  it('refuses a current stock not above Start of Day plus stock received today', async () => {
    const { onConfirm } = renderEndOfDay({ alreadyReceived: 3 });
    const box = screen.getByLabelText(/Current on-hand stock/);
    await userEvent.clear(box);
    await userEvent.type(box, '13');
    await submit();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Count cannot be less than opening stock \(10 L\) plus delivery \(10 L\)/)).toBeInTheDocument();
    expect(screen.getByText(/cancel to fix your End of Day count/)).toBeInTheDocument();
  });

  it('refuses a current stock below the dead stock', async () => {
    const { onConfirm } = renderEndOfDay({ deadStock: 5 });
    const box = screen.getByLabelText(/Current on-hand stock/);
    await userEvent.clear(box);
    await userEvent.type(box, '4');
    await submit();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/cannot be less than the dead stock/)).toBeInTheDocument();
  });

  it('refuses an empty current stock', async () => {
    const { onConfirm } = renderEndOfDay();
    await userEvent.clear(screen.getByLabelText(/Current on-hand stock/));
    await submit();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('says the admin has to approve before stock changes', () => {
    renderEndOfDay();
    expect(screen.getByText(/admin approves it before stock is updated/i)).toBeInTheDocument();
  });

  it('cancels', async () => {
    const { onCancel } = renderEndOfDay();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('ReceivedStockModal at Start of Day', () => {
  it('shows the orders as details with nothing to fill in and submits them all', async () => {
    const onConfirm = vi.fn();
    render(
      <ReceivedStockModal
        isOpen
        itemName="Milk"
        unit="L"
        snapshot="START_OF_DAY"
        startUsable={10}
        endUsable={14}
        orders={[{ id: 74, quantity: 5, supplierName: null, orderedAt: null }]}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Order #74/)).toBeInTheDocument();
    await submit();
    expect(onConfirm).toHaveBeenCalledWith([{ orderId: 74, quantity: 5 }]);
  });
});
