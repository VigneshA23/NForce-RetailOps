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
    renderStart([{ id: 7, quantity: 10, supplierName: 'Acme', orderedAt: null }]);
    expect(screen.getByText(/Start of Day \(30 Nos\.\) is higher than the last End of Day \(20 Nos\.\)/)).toBeInTheDocument();
  });

  it('shows the existing order as details and submits it without anything to fill in', async () => {
    const { onConfirm } = renderStart([{ id: 7, quantity: 10, supplierName: 'Acme', orderedAt: null }]);
    expect(screen.getByText(/Order #7 · 10 Nos\. · Acme/)).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Submit for approval' }));
    expect(onConfirm).toHaveBeenCalledWith([{ orderId: 7, quantity: 10 }]);
  });
});
