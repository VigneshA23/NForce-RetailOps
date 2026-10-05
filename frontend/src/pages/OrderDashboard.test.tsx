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
const mockUpdateOrderListEntry = vi.mocked(orderListApi.updateOrderListEntry);

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
  it('copies only the live NEEDS_ORDERING entries, grouped by supplier, with the store name and generation date, and shows success feedback', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 8, 30));
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
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
    expect(copied.startsWith('*REORDER LIST :*\n\n*Store  - Downtown*\n*Date   - September 30, 2026*')).toBe(true);
    expect(copied).toContain('Acme Supplies');
    expect(copied).toContain('* Milk — 12 gallons');
    expect(copied).toContain('Unassigned Supplier');
    expect(copied).toContain('* Cleaning Spray — 8 bottles');
    expect(copied).not.toContain('Bread');
    expect(nfToast.success).toHaveBeenCalledWith('Reorder list copied.');
    vi.useRealTimers();
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

describe('OrderDashboard filters', () => {
  beforeEach(() => {
    mockGetOrderList.mockReset().mockResolvedValue([
      entry({ id: 1, storeInventoryItemId: 101, itemName: 'Milk', supplierId: 1, supplierName: 'Acme Supplies', status: 'NEEDS_ORDERING' }),
      entry({ id: 2, storeInventoryItemId: 102, itemName: 'Bread', supplierId: 2, supplierName: 'Fresh Foods', status: 'ORDERED' }),
      entry({ id: 3, storeInventoryItemId: 103, itemName: 'Cleaning Spray', supplierId: null, supplierName: null, status: 'NEEDS_ORDERING' }),
    ]);
    mockGetOwnerSuppliers.mockReset().mockResolvedValue([
      { id: 1, name: 'Acme Supplies', active: true },
      { id: 2, name: 'Fresh Foods', active: true },
    ]);
  });

  it('filters the table by item name as the user types', async () => {
    const user = userEvent.setup();
    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.type(screen.getByPlaceholderText('Search items'), 'milk');

    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();
    expect(screen.queryByText('Cleaning Spray')).not.toBeInTheDocument();
  });

  it('filters the table to a single item via the items dropdown', async () => {
    const user = userEvent.setup();
    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Filter by item'));
    await user.click(screen.getByRole('option', { name: 'Bread' }));

    expect(screen.getByRole('cell', { name: 'Bread' })).toBeInTheDocument();
    expect(screen.queryByRole('cell', { name: 'Milk' })).not.toBeInTheDocument();
  });

  it('filters the table by supplier, including an Unassigned Supplier option', async () => {
    const user = userEvent.setup();
    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Filter by supplier'));
    await user.click(screen.getByRole('option', { name: 'Unassigned Supplier' }));

    expect(screen.getByText('Cleaning Spray')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();
  });

  it('always shows the Clear button, and it resets every filter', async () => {
    const user = userEvent.setup();
    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByText('Milk');

    // Always rendered, even with no filter active yet -- a stable, always
    // findable reset control rather than something that pops in and out.
    expect(screen.getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search items'), 'milk');
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Bread')).toBeInTheDocument();
    expect(screen.getByText('Cleaning Spray')).toBeInTheDocument();
  });
});

describe('OrderDashboard quick-advance confirmation', () => {
  beforeEach(() => {
    mockGetOrderList.mockReset().mockResolvedValue([
      entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING' }),
      entry({ id: 2, itemName: 'Bread', status: 'ORDERED' }),
    ]);
    mockGetOwnerSuppliers.mockReset().mockResolvedValue([]);
    mockUpdateOrderListEntry.mockReset();
  });

  it('does not change status immediately on click -- it opens a confirmation first', async () => {
    const user = userEvent.setup();
    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'Mark Milk ordered' }));

    expect(mockUpdateOrderListEntry).not.toHaveBeenCalled();
    expect(screen.getByText('Mark as Ordered?')).toBeInTheDocument();
    expect(screen.getByText('Mark "Milk" as ordered?')).toBeInTheDocument();
  });

  it('only calls the API once the user confirms', async () => {
    const user = userEvent.setup();
    mockUpdateOrderListEntry.mockResolvedValue(entry({ id: 1, itemName: 'Milk', status: 'ORDERED' }));
    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'Mark Milk ordered' }));
    await user.click(screen.getByRole('button', { name: 'Mark Ordered' }));

    expect(mockUpdateOrderListEntry).toHaveBeenCalledTimes(1);
    expect(mockUpdateOrderListEntry).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'ORDERED' }));
  });

  it('does not call the API when the user cancels', async () => {
    const user = userEvent.setup();
    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'Mark Bread received' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(mockUpdateOrderListEntry).not.toHaveBeenCalled();
    expect(screen.queryByText('Mark as Received?')).not.toBeInTheDocument();
  });
});
