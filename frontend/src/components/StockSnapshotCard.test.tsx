import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StockSnapshotCard from './StockSnapshotCard';
import type { StockSnapshot } from '../types/stockCheck';

const saved: StockSnapshot = {
  available: 50,
  deadStock: 2,
  usable: 48,
  enteredByName: 'John',
  enteredAt: '2026-09-30T09:05:00Z',
  lastUpdatedByName: 'John',
  lastUpdatedAt: '2026-09-30T09:05:00Z',
  edited: false,
};

describe('StockSnapshotCard', () => {
  it('saves a pending snapshot with available and dead stock', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<StockSnapshotCard title="Start of Day" idPrefix="milk-sod" unit="L" snapshot={null} onSave={onSave} />);

    expect(screen.getByText('Pending')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Available Stock'), '50');
    await user.clear(screen.getByLabelText('Dead Stock'));
    await user.type(screen.getByLabelText('Dead Stock'), '2');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSave).toHaveBeenCalledWith(50, 2);
  });

  it('blocks dead stock above available without calling the API', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<StockSnapshotCard title="End of Day" idPrefix="milk-eod" unit="L" snapshot={null} onSave={onSave} />);

    await user.type(screen.getByLabelText('Available Stock'), '3');
    await user.clear(screen.getByLabelText('Dead Stock'));
    await user.type(screen.getByLabelText('Dead Stock'), '5');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Dead stock cannot be more than available stock.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows a completed snapshot and edits it in place via Update', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<StockSnapshotCard title="Start of Day" idPrefix="milk-sod" unit="L" snapshot={saved} onSave={onSave} />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText(/Checked by John/)).toBeInTheDocument();
    expect(screen.getByText('48')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Edit/ }));
    const available = screen.getByLabelText('Available Stock');
    expect(available).toHaveValue(50);
    await user.clear(available);
    await user.type(available, '48');
    await user.click(screen.getByRole('button', { name: 'Update' }));

    expect(onSave).toHaveBeenCalledWith(48, 2);
  });
});
