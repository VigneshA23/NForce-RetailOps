import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ChangeOrderStatusModal from './ChangeOrderStatusModal';
import type { OrderStatus } from '../types/orderList';

function renderModal(fromStatus: OrderStatus, toStatus: OrderStatus, onConfirm = vi.fn()) {
  render(
    <ChangeOrderStatusModal
      itemName="Milk"
      supplierName="Dairy Co"
      category={null}
      imageId={null}
      fromStatus={fromStatus}
      toStatus={toStatus}
      orderedQuantity={7.5}
      unitOfMeasurement="L"
      onConfirm={onConfirm}
      onCancel={vi.fn()}
    />,
  );
  return onConfirm;
}

describe('ChangeOrderStatusModal', () => {
  it('asks for the quantity received on Ordered -> Received, defaulting to the ordered quantity', () => {
    renderModal('ORDERED', 'RECEIVED');

    expect(screen.getByText('Confirm stock received')).toBeInTheDocument();
    expect(screen.getByLabelText('Quantity received (L)')).toHaveValue('7.5');
  });

  it('confirms with the default quantity when it is left alone', async () => {
    const user = userEvent.setup();
    const onConfirm = renderModal('ORDERED', 'RECEIVED');

    await user.click(screen.getByRole('button', { name: 'Confirm received' }));

    expect(onConfirm).toHaveBeenCalledWith(7.5);
  });

  it('confirms with an edited quantity', async () => {
    const user = userEvent.setup();
    const onConfirm = renderModal('ORDERED', 'RECEIVED');

    const input = screen.getByLabelText('Quantity received (L)');
    await user.clear(input);
    await user.type(input, '5.25');
    await user.click(screen.getByRole('button', { name: 'Confirm received' }));

    expect(onConfirm).toHaveBeenCalledWith(5.25);
  });

  it.each(['', '0', 'abc', '1.234', '-2'])('blocks confirming with an invalid quantity (%j)', async (text) => {
    const user = userEvent.setup();
    const onConfirm = renderModal('ORDERED', 'RECEIVED');

    const input = screen.getByLabelText('Quantity received (L)');
    await user.clear(input);
    if (text) await user.type(input, text);
    await user.click(screen.getByRole('button', { name: 'Confirm received' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Enter a quantity greater than 0 (up to 2 decimals)')).toBeInTheDocument();
  });

  it('shows no quantity box for other transitions', async () => {
    const user = userEvent.setup();
    const onConfirm = renderModal('NEEDS_ORDERING', 'ORDERED');

    expect(screen.queryByLabelText(/Quantity received/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Yes, change' }));

    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });
});
