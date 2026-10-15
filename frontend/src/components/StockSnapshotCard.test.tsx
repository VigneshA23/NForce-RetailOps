import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import StockSnapshotCard from './StockSnapshotCard';
import type { StockSnapshot } from '../types/stockCheck';
import { nfToast } from '../utils/toast';

vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const saved: StockSnapshot = {
  available: 50,
  deadStock: 2,
  usable: 48,
  enteredById: 1,
  enteredByName: 'John',
  enteredAt: '2026-09-30T09:05:00Z',
  lastUpdatedByName: 'John',
  lastUpdatedByAvatarUrl: null,
  lastUpdatedAt: '2026-09-30T09:05:00Z',
  edited: false,
};

describe('StockSnapshotCard', () => {
  it('saves a not-yet-recorded snapshot with available and dead stock', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<StockSnapshotCard title="Start of Day" idPrefix="milk-sod" snapshot={null} onSave={onSave} />);

    expect(screen.getByText('In Progress')).toHaveClass('badge--warning');
    await user.type(screen.getByLabelText('Total Stock'), '50');
    await user.clear(screen.getByLabelText('Dead / Spoilage'));
    await user.type(screen.getByLabelText('Dead / Spoilage'), '2');
    await user.click(screen.getByRole('button', { name: 'Save Check' }));

    expect(onSave).toHaveBeenCalledWith(50, 2);
  });

  it('blocks dead stock above available without calling the API', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<StockSnapshotCard title="End of Day" idPrefix="milk-eod" snapshot={null} onSave={onSave} />);

    await user.type(screen.getByLabelText('Total Stock'), '3');
    await user.clear(screen.getByLabelText('Dead / Spoilage'));
    await user.type(screen.getByLabelText('Dead / Spoilage'), '5');
    await user.click(screen.getByRole('button', { name: 'Save Check' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Dead stock cannot be more than available stock.');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('shows a saved snapshot pre-filled and editable via Update Count', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(true);
    render(<StockSnapshotCard title="Start of Day" idPrefix="milk-sod" snapshot={saved} onSave={onSave} />);

    expect(screen.getByText('Editable Count')).toBeInTheDocument();
    expect(screen.getByText(/Verified by John/)).toBeInTheDocument();

    const available = screen.getByLabelText('Total Stock');
    expect(available).toHaveValue(50);
    await user.clear(available);
    await user.type(available, '48');
    await user.click(screen.getByRole('button', { name: 'Update Count' }));

    expect(onSave).toHaveBeenCalledWith(48, 2);
  });

  it('disables End of Day with its reason when Start of Day has not been saved', () => {
    const onSave = vi.fn();
    render(
      <StockSnapshotCard
        title="End of Day"
        idPrefix="milk-eod"
        snapshot={null}
        onSave={onSave}
        disabledReason="Submit the Start of Day count first"
      />,
    );

    expect(screen.getByText('Submit the Start of Day count first')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Check' })).not.toBeInTheDocument();
    expect(screen.getByLabelText('Total Stock')).toBeDisabled();
    expect(screen.getByLabelText('Dead / Spoilage')).toBeDisabled();
  });

  it('shows a toast with the reason when the disabled End of Day area is tapped', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <StockSnapshotCard
        title="End of Day"
        idPrefix="milk-eod"
        snapshot={null}
        onSave={onSave}
        disabledReason="Start of Day stock check not submitted"
      />,
    );

    await user.click(screen.getByLabelText('Start of Day stock check not submitted'));

    expect(nfToast.error).toHaveBeenCalledWith('Start of Day stock check not submitted');
  });
});
