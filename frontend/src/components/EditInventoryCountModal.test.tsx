import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import EditInventoryCountModal from './EditInventoryCountModal';
import type { InventoryCountRow } from '../types/storeInventory';

const ROW: InventoryCountRow = {
  itemId: 1,
  name: 'Milk',
  category: 'DAIRY',
  unitOfMeasurement: 'L',
  currentStock: 30,
  minimum: 20,
  status: 'HEALTHY',
  lastUpdatedAt: '2026-09-24T15:30:00Z',
  lastUpdatedByName: 'Sarah',
  change: 6,
  changeFromDate: '2026-09-23',
  latestCheckId: 42,
  latestSnapshot: 'END_OF_DAY',
  latestAvailable: 30,
  latestDeadStock: 2,
};

describe('EditInventoryCountModal', () => {
  it('seeds the stepper with the latest available count and submits the default reason unchanged', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EditInventoryCountModal isOpen row={ROW} onClose={vi.fn()} onSubmit={onSubmit} />);

    expect(screen.getByRole('spinbutton')).toHaveValue(30);
    await user.click(screen.getByRole('button', { name: 'Save count' }));

    expect(onSubmit).toHaveBeenCalledWith({ available: 30, reason: 'Recount (count was wrong)' });
  });

  it('shows the diff against the last count once the stepper changes', async () => {
    const user = userEvent.setup();
    render(<EditInventoryCountModal isOpen row={ROW} onClose={vi.fn()} onSubmit={vi.fn()} />);

    expect(screen.queryByText(/vs\. last count/)).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByLabelText('Increase'));

    expect(screen.getByText('+2 L vs. last count')).toBeInTheDocument();
  });

  it('appends an optional note to the selected reason label', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<EditInventoryCountModal isOpen row={ROW} onClose={vi.fn()} onSubmit={onSubmit} />);

    await user.click(screen.getByLabelText('Reason'));
    await user.click(screen.getByRole('option', { name: 'Waste or spoilage' }));
    await user.type(screen.getByPlaceholderText(/found 2 extra/i), 'Spilled crate');
    await user.click(screen.getByRole('button', { name: 'Save count' }));

    expect(onSubmit).toHaveBeenCalledWith({ available: 30, reason: 'Waste or spoilage — Spilled crate' });
  });

  it('disables the save button and shows an error message while submitting', () => {
    render(
      <EditInventoryCountModal
        isOpen
        row={ROW}
        isSubmitting
        errorMessage="Failed to update count"
        onClose={vi.fn()}
        onSubmit={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Saving' })).toBeDisabled();
    expect(screen.getByText('Failed to update count')).toBeInTheDocument();
  });

  it('renders nothing when there is no target row', () => {
    const { container } = render(<EditInventoryCountModal isOpen row={null} onClose={vi.fn()} onSubmit={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
