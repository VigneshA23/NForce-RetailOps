import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CorrectStockCheckModal from './CorrectStockCheckModal';
import type { StockCheckResponse } from '../types/stockCheck';

const ROW: StockCheckResponse = {
  id: 7,
  storeInventoryItemId: 1,
  itemName: 'Milk',
  category: 'DAIRY',
  unitOfMeasurement: 'L',
  checkDate: '2026-09-20',
  requiredPar: 20,
  startOfDay: {
    available: 48,
    deadStock: 2,
    usable: 46,
    enteredById: 1,
    enteredByName: 'John',
    enteredAt: '2026-09-20T09:00:00Z',
    lastUpdatedByName: 'John',
    lastUpdatedAt: '2026-09-20T09:00:00Z',
    edited: false,
  },
  endOfDay: null,
  stockUsed: null,
  requiredTomorrow: null,
  quantityToOrder: null,
  edits: [{
    snapshot: 'START_OF_DAY',
    previousAvailable: 50,
    previousDeadStock: 2,
    newAvailable: 48,
    newDeadStock: 2,
    editedByName: 'Owner Olivia',
    editedAt: '2026-09-20T10:00:00Z',
    reason: 'Recount (count was wrong)',
  }],
};

describe('CorrectStockCheckModal', () => {
  it('pre-fills available and dead stock from the chosen snapshot', () => {
    render(
      <CorrectStockCheckModal isOpen row={ROW} snapshot="START_OF_DAY" onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    const [available, deadStock] = screen.getAllByRole('spinbutton');
    expect(available).toHaveValue(48);
    expect(deadStock).toHaveValue(2);
  });

  it('shows the prior correction for that snapshot only', () => {
    render(
      <CorrectStockCheckModal
        isOpen
        row={{
          ...ROW,
          edits: [
            ...ROW.edits,
            { ...ROW.edits[0], snapshot: 'END_OF_DAY', previousAvailable: 10, newAvailable: 8 },
          ],
        }}
        snapshot="START_OF_DAY"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByText('50 (2 dead) → 48 (2 dead)')).toBeInTheDocument();
    expect(screen.queryByText('10 (2 dead) → 8 (2 dead)')).not.toBeInTheDocument();
  });

  it('shows no-corrections-yet when the snapshot has never been edited', () => {
    render(
      <CorrectStockCheckModal isOpen row={{ ...ROW, edits: [] }} snapshot="START_OF_DAY" onClose={vi.fn()} onSubmit={vi.fn()} />,
    );

    expect(screen.getByText('No corrections recorded yet.')).toBeInTheDocument();
  });

  it('submits available, dead stock, and the selected reason', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <CorrectStockCheckModal isOpen row={ROW} snapshot="START_OF_DAY" onClose={vi.fn()} onSubmit={onSubmit} />,
    );

    await user.click(within(screen.getByRole('group', { name: 'Available' })).getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Save correction' }));

    expect(onSubmit).toHaveBeenCalledWith({ available: 49, deadStock: 2, reason: 'Recount (count was wrong)' });
  });

  it('renders nothing without a row or snapshot', () => {
    const { container } = render(
      <CorrectStockCheckModal isOpen row={null} snapshot={null} onClose={vi.fn()} onSubmit={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
