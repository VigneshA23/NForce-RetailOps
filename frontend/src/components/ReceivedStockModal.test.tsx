import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReceivedStockModal from './ReceivedStockModal';
import type { OpenOrder } from '../types/stockCheck';

function renderModal(alreadyReceived = 0, orders: OpenOrder[] = []) {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ReceivedStockModal
      isOpen
      itemName="Milk"
      unit="L"
      startUsable={10}
      endUsable={20}
      alreadyReceived={alreadyReceived}
      orders={orders}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

async function submit(value: string) {
  const input = screen.getByLabelText(/Stock received today/);
  await userEvent.clear(input);
  if (value) await userEvent.type(input, value);
  await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
}

describe('ReceivedStockModal', () => {
  it('explains why it is asking and offers no way to skip', () => {
    renderModal();
    expect(screen.getByText(/End of Day \(20 L\) is higher than Start of Day \(10 L\)/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /no stock received/i })).not.toBeInTheDocument();
  });

  it('confirms when Start of Day + received covers End of Day', async () => {
    const { onConfirm } = renderModal();
    await submit('10');
    expect(onConfirm).toHaveBeenCalledWith([{ orderId: null, quantity: 10 }]);
  });

  it('rejects a quantity too small to explain the End of Day count', async () => {
    const { onConfirm } = renderModal();
    await submit('9');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Value should be greater than or equal to 10/)).toBeInTheDocument();
  });

  it('counts stock already received today towards the minimum', async () => {
    const { onConfirm } = renderModal(6);
    await submit('3');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Value should be greater than or equal to 4/)).toBeInTheDocument();
    await submit('4');
    expect(onConfirm).toHaveBeenCalledWith([{ orderId: null, quantity: 4 }]);
  });

  it('rejects an empty quantity', async () => {
    const { onConfirm } = renderModal();
    await submit('');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/greater than 0/)).toBeInTheDocument();
  });

  it('says the admin has to approve before stock changes', () => {
    renderModal();
    expect(screen.getByText(/admin has to approve it before stock is updated/i)).toBeInTheDocument();
  });

  it('offers no order choice when the item has no Ordered orders', () => {
    renderModal();
    expect(screen.queryByText('What was received?')).not.toBeInTheDocument();
  });

  it('lets the employee confirm one existing Ordered order, prefilling what was ordered', async () => {
    const { onConfirm } = renderModal(0, [
      { id: 74, quantity: 1, supplierName: null, orderedAt: null },
      { id: 77, quantity: 12, supplierName: 'Dairy Co', orderedAt: null },
    ]);
    await userEvent.click(screen.getByLabelText(/Order #77 · 12 L/));
    expect(screen.getByLabelText(/Stock received today/)).toHaveValue('12');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(onConfirm).toHaveBeenCalledWith([{ orderId: 77, quantity: 12 }]);
  });

  it('lets the employee confirm several orders together', async () => {
    const { onConfirm } = renderModal(0, [
      { id: 74, quantity: 6, supplierName: null, orderedAt: null },
      { id: 77, quantity: 4, supplierName: null, orderedAt: null },
    ]);
    await userEvent.click(screen.getByLabelText(/^Ordered: Order #74/));
    await userEvent.click(screen.getByLabelText(/^Ordered: Order #77/));
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    const items = onConfirm.mock.calls[0][0];
    expect(screen.getByLabelText(/Stock received today/)).toHaveValue('10');
    expect(items).toHaveLength(2);
    expect(items).toEqual(expect.arrayContaining([
      { orderId: 74, quantity: 6 },
      { orderId: 77, quantity: 4 },
    ]));
  });

  it('requires something to be selected and the total to cover the gap', async () => {
    const { onConfirm } = renderModal(0, [{ id: 74, quantity: 1, supplierName: null, orderedAt: null }]);
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(screen.getByText('Select what was received')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/^Ordered: Order #74/));
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/Value should be greater than or equal to 10/)).toBeInTheDocument();
  });
});

describe('ReceivedStockModal exclusivity', () => {
  const orders = [
    { id: 74, quantity: 1, supplierName: null, orderedAt: null },
    { id: 77, quantity: 4, supplierName: null, orderedAt: null },
  ];

  it('disables new stock once an order is selected, but keeps other orders selectable', async () => {
    renderModal(0, orders);
    await userEvent.click(screen.getByLabelText(/^Ordered: Order #74/));
    expect(screen.getByLabelText(/New stock, not on an existing order/)).toBeDisabled();
    expect(screen.getByLabelText(/^Ordered: Order #77/)).toBeEnabled();
    await userEvent.click(screen.getByLabelText(/^Ordered: Order #74/));
    expect(screen.getByLabelText(/New stock, not on an existing order/)).toBeEnabled();
  });

  it('disables every order once new stock is selected', async () => {
    renderModal(0, orders);
    await userEvent.click(screen.getByLabelText(/New stock, not on an existing order/));
    expect(screen.getByLabelText(/^Ordered: Order #74/)).toBeDisabled();
    expect(screen.getByLabelText(/^Ordered: Order #77/)).toBeDisabled();
  });

  it('has one quantity box that rises and falls with the selected orders', async () => {
    renderModal(0, orders);
    const box = screen.getByLabelText(/Stock received today/);
    await userEvent.click(screen.getByLabelText(/^Ordered: Order #74/));
    expect(box).toHaveValue('1');
    await userEvent.click(screen.getByLabelText(/^Ordered: Order #77/));
    expect(box).toHaveValue('5');
    expect(box).toHaveAttribute('readonly');
    await userEvent.click(screen.getByLabelText(/^Ordered: Order #74/));
    expect(box).toHaveValue('4');
    expect(box).not.toHaveAttribute('readonly');
  });
});
