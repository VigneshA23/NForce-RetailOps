import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LowerCountModal from './LowerCountModal';
import ReceivedStockModal from './ReceivedStockModal';
import type { OpenOrder } from '../types/stockCheck';

function renderLower() {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <LowerCountModal
      isOpen
      itemName="Paper Cups"
      unit="Nos."
      countedUsable={4}
      expectedUsable={20}
      previousByName="Ananya"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { onConfirm, onCancel };
}

describe('LowerCountModal', () => {
  it('names the last End of Day, who submitted it and both figures', () => {
    renderLower();
    expect(screen.getByText(/you counted 4 Nos\./)).toBeInTheDocument();
    expect(screen.getByText(/submitted by Ananya/)).toBeInTheDocument();
    expect(screen.getByText(/leaves 20 Nos\./)).toBeInTheDocument();
  });

  it('requires a reason before asking for approval', async () => {
    const { onConfirm } = renderLower();
    await userEvent.click(screen.getByRole('button', { name: 'Request approval' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Give a reason for the lower count')).toBeInTheDocument();
  });

  it('sends the trimmed reason', async () => {
    const { onConfirm } = renderLower();
    await userEvent.type(screen.getByLabelText('Reason'), '  Spilled overnight ');
    await userEvent.click(screen.getByRole('button', { name: 'Request approval' }));
    expect(onConfirm).toHaveBeenCalledWith('Spilled overnight');
  });

  it('lets the employee go back and recount', async () => {
    const { onCancel } = renderLower();
    await userEvent.click(screen.getByRole('button', { name: 'Recount' }));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('ReceivedStockModal at Start of Day', () => {
  function renderStart(orders: OpenOrder[] = []) {
    const onConfirm = vi.fn();
    render(
      <ReceivedStockModal
        isOpen
        snapshot="START_OF_DAY"
        itemName="Paper Cups"
        unit="Nos."
        startUsable={20}
        endUsable={30}
        orders={orders}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />,
    );
    return { onConfirm };
  }

  it('explains the Start of Day is higher than the last End of Day', () => {
    renderStart();
    expect(screen.getByText(/Start of Day \(30 Nos\.\) is higher than the last End of Day \(20 Nos\.\)/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stock restocked/)).toBeInTheDocument();
  });

  it('refuses a restock that does not cover the gap', async () => {
    const { onConfirm } = renderStart();
    await userEvent.type(screen.getByLabelText(/Stock restocked/), '4');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText('Value should be greater than or equal to 10')).toBeInTheDocument();
  });

  it('fills the quantity from an existing order that was received', async () => {
    const { onConfirm } = renderStart([{ id: 7, quantity: 10, supplierName: 'Acme', orderedAt: null }]);
    await userEvent.click(screen.getByLabelText(/Order #7/));
    expect(screen.getByLabelText(/Stock restocked/)).toHaveValue('10');
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(onConfirm).toHaveBeenCalledWith([{ orderId: 7, quantity: 10 }]);
  });
});
