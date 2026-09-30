import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderDashboard from './OrderDashboard';
import * as orderListApi from '../api/orderList';
import * as suppliersApi from '../api/suppliers';
import type { OrderListEntry } from '../types/orderList';

vi.mock('../api/orderList', () => ({
  getOrderList: vi.fn(),
  updateOrderListEntry: vi.fn(),
  getNeedsOrderingCount: vi.fn(),
}));
vi.mock('../api/suppliers', () => ({ getOwnerSuppliers: vi.fn() }));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockGetOrderList = vi.mocked(orderListApi.getOrderList);
const mockGetOwnerSuppliers = vi.mocked(suppliersApi.getOwnerSuppliers);

function entry(overrides: Partial<OrderListEntry>): OrderListEntry {
  return {
    id: 1,
    storeInventoryItemId: 100,
    itemName: 'Milk',
    unitOfMeasurement: 'L',
    quantityNeeded: 2,
    supplierId: null,
    supplierName: null,
    note: null,
    status: 'NEEDS_ORDERING',
    adHoc: false,
    raisedByName: null,
    createdAt: '2026-09-24T15:30:00Z',
    updatedAt: '2026-09-24T15:30:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockGetOwnerSuppliers.mockReset().mockResolvedValue([]);
  mockGetOrderList.mockReset().mockResolvedValue([
    entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING' }),
    entry({ id: 2, itemName: 'Bread', status: 'ORDERED' }),
    entry({ id: 3, itemName: 'Eggs', status: 'RECEIVED' }),
  ]);
});

describe('OrderDashboard status seed', () => {
  it('shows every status when no seed is given', async () => {
    render(<OrderDashboard storeName="Downtown" />);

    expect(await screen.findByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Bread')).toBeInTheDocument();
    expect(screen.getByText('Eggs')).toBeInTheDocument();
  });

  // The owner shell keeps this tab mounted and hidden, so arriving from the Home
  // tile is a prop change on an ALREADY-MOUNTED component, not a fresh mount.
  // Seeding via rerender is what reproduces that; a plain render would pass even
  // if the filter were only read at mount time.
  it('applies the filter to an already-mounted tab', async () => {
    const { rerender } = render(<OrderDashboard storeName="Downtown" />);

    expect(await screen.findByText('Bread')).toBeInTheDocument();

    rerender(<OrderDashboard storeName="Downtown" seed={{ status: 'NEEDS_ORDERING', id: 1 }} />);

    await waitFor(() => expect(screen.queryByText('Bread')).not.toBeInTheDocument());
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Eggs')).not.toBeInTheDocument();
    // The data is untouched -- only the filter changed.
    expect(mockGetOrderList).toHaveBeenCalledTimes(1);
  });

  it('does not re-apply the same seed after the user changes the filter', async () => {
    const user = userEvent.setup();
    const seed = { status: 'NEEDS_ORDERING', id: 1 };

    const { rerender } = render(<OrderDashboard storeName="Downtown" seed={seed} />);

    await waitFor(() => expect(screen.queryByText('Bread')).not.toBeInTheDocument());

    await user.click(screen.getByLabelText('Filter by status'));
    await user.click(screen.getByRole('option', { name: 'All Statuses' }));
    expect(await screen.findByText('Bread')).toBeInTheDocument();

    // An unrelated re-render with the same seed object must not clobber the
    // user's choice -- the nonce guard is what prevents that.
    rerender(<OrderDashboard storeName="Downtown" seed={seed} />);

    expect(screen.getByText('Bread')).toBeInTheDocument();
    expect(screen.getByText('Eggs')).toBeInTheDocument();
  });

  it('re-applies when a fresh seed nonce arrives', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <OrderDashboard storeName="Downtown" seed={{ status: 'NEEDS_ORDERING', id: 1 }} />,
    );

    await waitFor(() => expect(screen.queryByText('Bread')).not.toBeInTheDocument());

    await user.click(screen.getByLabelText('Filter by status'));
    await user.click(screen.getByRole('option', { name: 'All Statuses' }));
    expect(await screen.findByText('Bread')).toBeInTheDocument();

    // Same status, new nonce: clicking the Home tile a second time must filter again.
    rerender(<OrderDashboard storeName="Downtown" seed={{ status: 'NEEDS_ORDERING', id: 2 }} />);

    await waitFor(() => expect(screen.queryByText('Bread')).not.toBeInTheDocument());
  });
});

describe('OrderDashboard Copy Reorder List', () => {
  it('copies only the live NEEDS_ORDERING entries, grouped by supplier, and shows success feedback', async () => {
    const user = userEvent.setup();
    mockGetOrderList.mockReset().mockResolvedValue([
      entry({ id: 1, itemName: 'Milk', unitOfMeasurement: 'gallons', quantityNeeded: 12, status: 'NEEDS_ORDERING', supplierId: 1, supplierName: 'Acme Supplies' }),
      entry({ id: 2, itemName: 'Bread', status: 'ORDERED', supplierId: 1, supplierName: 'Acme Supplies' }),
      entry({ id: 3, itemName: 'Cleaning Spray', quantityNeeded: 8, unitOfMeasurement: 'bottles', status: 'NEEDS_ORDERING', supplierId: null, supplierName: null }),
    ]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { nfToast } = await import('../utils/toast');

    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: /copy reorder list/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('REORDER LIST');
    expect(copied).toContain('Acme Supplies');
    expect(copied).toContain('* Milk — 12 gallons');
    expect(copied).toContain('Unassigned Supplier');
    expect(copied).toContain('* Cleaning Spray — 8 bottles');
    expect(copied).not.toContain('Bread');
    expect(nfToast.success).toHaveBeenCalledWith('Reorder list copied.');
  });

  it('disables the Copy Reorder List button when nothing currently needs ordering', async () => {
    mockGetOrderList.mockReset().mockResolvedValue([
      entry({ id: 1, itemName: 'Bread', status: 'ORDERED' }),
      entry({ id: 2, itemName: 'Eggs', status: 'RECEIVED' }),
    ]);

    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByText('Bread');

    expect(screen.getByRole('button', { name: /copy reorder list/i })).toBeDisabled();
  });
});
