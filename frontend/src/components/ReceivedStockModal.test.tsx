import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ReceivedStockModal from './ReceivedStockModal';

function renderModal(alreadyReceived = 0) {
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
  await userEvent.click(screen.getByRole('button', { name: 'Add received & save' }));
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
    expect(onConfirm).toHaveBeenCalledWith(10);
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
    expect(onConfirm).toHaveBeenCalledWith(4);
  });

  it('rejects an empty quantity', async () => {
    const { onConfirm } = renderModal();
    await submit('');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(screen.getByText(/greater than 0/)).toBeInTheDocument();
  });
});
