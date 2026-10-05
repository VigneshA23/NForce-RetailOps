import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderList from './OrderList';
import * as orderListApi from '../api/orderList';
import * as suppliersApi from '../api/suppliers';
import * as storeInventoryApi from '../api/storeInventory';
import type { OrderListEntry } from '../types/orderList';
import type { StoreInventoryItem, InventoryCountsPage } from '../types/storeInventory';

vi.mock('../api/orderList', () => ({
  getOrderList: vi.fn(),
  updateOrderListEntry: vi.fn(),
  createOrderListEntry: vi.fn(),
  getNeedsOrderingCount: vi.fn(),
}));
vi.mock('../api/suppliers', () => ({ getOwnerSuppliers: vi.fn() }));
vi.mock('../api/storeInventory', () => ({
  getStoreInventoryItems: vi.fn(),
  getInventoryCounts: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const mockGetOrderList = vi.mocked(orderListApi.getOrderList);
const mockGetOwnerSuppliers = vi.mocked(suppliersApi.getOwnerSuppliers);
const mockUpdateOrderListEntry = vi.mocked(orderListApi.updateOrderListEntry);
const mockCreateOrderListEntry = vi.mocked(orderListApi.createOrderListEntry);
const mockGetStoreInventoryItems = vi.mocked(storeInventoryApi.getStoreInventoryItems);
const mockGetInventoryCounts = vi.mocked(storeInventoryApi.getInventoryCounts);

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

function inventoryItem(overrides: Partial<StoreInventoryItem>): StoreInventoryItem {
  return {
    id: 100,
    storeId: 1,
    storeName: 'Downtown',
    name: 'Milk',
    category: 'DAIRY',
    unitOfMeasurement: 'L',
    minWeekday: 5,
    minWeekend: 5,
    preferredSupplierId: null,
    preferredSupplierName: null,
    note: null,
    active: true,
    requiredToday: 5,
    currentAvailable: 10,
    ...overrides,
  };
}

function countsPage(overrides: Partial<InventoryCountsPage> = {}): InventoryCountsPage {
  return {
    rows: [],
    page: 1,
    size: 500,
    totalPages: 1,
    totalElements: 0,
    allCount: 0,
    outCount: 0,
    lowCount: 0,
    staleCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetOwnerSuppliers.mockReset().mockResolvedValue([]);
  mockGetStoreInventoryItems.mockReset().mockResolvedValue([]);
  mockGetInventoryCounts.mockReset().mockResolvedValue(countsPage());
  mockUpdateOrderListEntry.mockReset();
  mockCreateOrderListEntry.mockReset();
  mockGetOrderList.mockReset().mockResolvedValue([
    entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING' }),
    entry({ id: 2, itemName: 'Bread', status: 'ORDERED' }),
    entry({ id: 3, itemName: 'Eggs', status: 'RECEIVED' }),
  ]);
});

describe('OrderList status filter', () => {
  it('defaults to "All open", hiding already-received entries', async () => {
    render(<OrderList storeName="Downtown" />);

    expect(await screen.findByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Bread')).toBeInTheDocument();
    expect(screen.queryByText('Eggs')).not.toBeInTheDocument();
  });

  it('shows received entries once that status is explicitly selected', async () => {
    const user = userEvent.setup();
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    // Switch to the flat list so an empty (and therefore collapsed-by-default)
    // supplier group can't hide the row this test is checking for.
    await user.click(screen.getByRole('button', { name: 'List' }));
    await user.click(screen.getByLabelText('Status'));
    await user.click(screen.getByRole('option', { name: 'Received' }));

    expect(screen.getByText('Eggs')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
  });

  // The owner shell keeps this tab mounted and hidden, so arriving from the Home
  // tile is a prop change on an ALREADY-MOUNTED component, not a fresh mount.
  // Seeding via rerender is what reproduces that; a plain render would pass even
  // if the filter were only read at mount time.
  it('applies the seed filter to an already-mounted tab', async () => {
    const { rerender } = render(<OrderList storeName="Downtown" />);

    expect(await screen.findByText('Bread')).toBeInTheDocument();

    rerender(<OrderList storeName="Downtown" seed={{ status: 'NEEDS_ORDERING', id: 1 }} />);

    await waitFor(() => expect(screen.queryByText('Bread')).not.toBeInTheDocument());
    expect(screen.getByText('Milk')).toBeInTheDocument();
    // The data is untouched -- only the filter changed.
    expect(mockGetOrderList).toHaveBeenCalledTimes(1);
  });

  it('does not re-apply the same seed after the user changes the filter', async () => {
    const user = userEvent.setup();
    const seed = { status: 'NEEDS_ORDERING', id: 1 };

    const { rerender } = render(<OrderList storeName="Downtown" seed={seed} />);

    await waitFor(() => expect(screen.queryByText('Bread')).not.toBeInTheDocument());

    await user.click(screen.getByLabelText('Status'));
    await user.click(screen.getByRole('option', { name: 'All open' }));
    expect(await screen.findByText('Bread')).toBeInTheDocument();

    // An unrelated re-render with the same seed object must not clobber the
    // user's choice -- the nonce guard is what prevents that.
    rerender(<OrderList storeName="Downtown" seed={seed} />);

    expect(screen.getByText('Bread')).toBeInTheDocument();
  });
});

describe('OrderList filters', () => {
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
    mockGetStoreInventoryItems.mockReset().mockResolvedValue([
      inventoryItem({ id: 101, name: 'Milk', category: 'DAIRY' }),
      inventoryItem({ id: 102, name: 'Bread', category: 'INGREDIENTS' }),
      inventoryItem({ id: 103, name: 'Cleaning Spray', category: 'CLEANING' }),
    ]);
  });

  it('filters by item name as the user types', async () => {
    const user = userEvent.setup();
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.type(screen.getByPlaceholderText('Search items'), 'milk');

    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();
    expect(screen.queryByText('Cleaning Spray')).not.toBeInTheDocument();
  });

  it('filters by category', async () => {
    const user = userEvent.setup();
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Category'));
    await user.click(screen.getByRole('option', { name: 'Cleaning' }));

    expect(screen.getByText('Cleaning Spray')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();
  });

  it('filters by supplier, including an Unassigned Supplier option', async () => {
    const user = userEvent.setup();
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Supplier'));
    await user.click(screen.getByRole('option', { name: 'Unassigned Supplier' }));

    expect(screen.getByText('Cleaning Spray')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();
  });

  it('shows a Clear button once any filter is active, and it resets every filter', async () => {
    const user = userEvent.setup();
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search items'), 'milk');
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Cleaning Spray')).toBeInTheDocument();
    // Bread's supplier group (Fresh Foods) has nothing left to order, so it
    // starts collapsed by default -- its header is back, even if the row
    // itself needs an explicit expand to see.
    expect(screen.getByRole('button', { name: /Fresh Foods/ })).toBeInTheDocument();
  });
});

describe('OrderList view toggle', () => {
  beforeEach(() => {
    mockGetOrderList.mockReset().mockResolvedValue([
      entry({ id: 1, itemName: 'Milk', supplierId: 1, supplierName: 'Acme Supplies', status: 'NEEDS_ORDERING' }),
      entry({ id: 2, itemName: 'Bread', supplierId: null, supplierName: null, status: 'ORDERED' }),
    ]);
    mockGetOwnerSuppliers.mockReset().mockResolvedValue([{ id: 1, name: 'Acme Supplies', active: true }]);
  });

  it('groups entries by supplier by default, with unassigned items under "Unassigned Supplier"', async () => {
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    expect(screen.getByRole('button', { name: /Acme Supplies/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unassigned Supplier/ })).toBeInTheDocument();
  });

  it('collapses and re-expands a supplier group without losing its rows', async () => {
    const user = userEvent.setup();
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: /Acme Supplies/ }));
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Acme Supplies/ }));
    expect(screen.getByText('Milk')).toBeInTheDocument();
  });

  it('switches to a flat list with no group headers', async () => {
    const user = userEvent.setup();
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'List' }));

    expect(screen.queryByRole('button', { name: /Acme Supplies/ })).not.toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Bread')).toBeInTheDocument();
  });
});

describe('OrderList inline status change', () => {
  beforeEach(() => {
    mockGetOrderList.mockReset().mockResolvedValue([entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING' })]);
  });

  it('updates status immediately when the inline dropdown changes', async () => {
    const user = userEvent.setup();
    mockUpdateOrderListEntry.mockResolvedValue(entry({ id: 1, itemName: 'Milk', status: 'ORDERED' }));
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Change status for Milk'));
    await user.click(screen.getByRole('option', { name: 'Ordered' }));

    expect(mockUpdateOrderListEntry).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'ORDERED' }));
  });
});

describe('OrderList edit modal', () => {
  it('saves quantity/supplier/note/status changes through the edit modal', async () => {
    const user = userEvent.setup();
    mockGetOrderList.mockReset().mockResolvedValue([entry({ id: 1, itemName: 'Milk', quantityNeeded: 2, status: 'NEEDS_ORDERING' })]);
    mockUpdateOrderListEntry.mockResolvedValue(entry({ id: 1, itemName: 'Milk', quantityNeeded: 5, status: 'ORDERED' }));
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Edit Milk'));
    expect(await screen.findByText('Edit Order — Milk')).toBeInTheDocument();

    const quantityInput = screen.getByLabelText(/Quantity Needed/);
    await user.clear(quantityInput);
    await user.type(quantityInput, '5');
    await user.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => expect(mockUpdateOrderListEntry).toHaveBeenCalledWith(1, expect.objectContaining({ quantityNeeded: '5' })));
  });
});

describe('OrderList bulk selection', () => {
  beforeEach(() => {
    mockGetOrderList.mockReset().mockResolvedValue([
      entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING', supplierId: null, supplierName: null }),
      entry({ id: 2, itemName: 'Bread', status: 'NEEDS_ORDERING', supplierId: null, supplierName: null }),
    ]);
  });

  it('keeps the bulk action buttons disabled until rows are selected, then marks them ordered together', async () => {
    const user = userEvent.setup();
    mockUpdateOrderListEntry.mockImplementation((id) =>
      Promise.resolve(entry({ id, itemName: id === 1 ? 'Milk' : 'Bread', status: 'ORDERED' })),
    );
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    expect(screen.getByRole('button', { name: 'Mark ordered' })).toBeDisabled();

    await user.click(screen.getByLabelText('Select Milk'));
    await user.click(screen.getByLabelText('Select Bread'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark ordered' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Mark ordered' }));

    await waitFor(() => expect(mockUpdateOrderListEntry).toHaveBeenCalledTimes(2));
    expect(mockUpdateOrderListEntry).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'ORDERED' }));
    expect(mockUpdateOrderListEntry).toHaveBeenCalledWith(2, expect.objectContaining({ status: 'ORDERED' }));
  });

  it('copies only the selected rows via Copy selected items', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Select Milk'));
    await user.click(screen.getByRole('button', { name: 'Copy selected items' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('Milk');
    expect(copied).not.toContain('Bread');
  });

  it('selects and deselects every visible row via the header checkbox', async () => {
    const user = userEvent.setup();
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Select all visible orders'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Select all visible orders'));
    expect(screen.queryByText('2 selected')).not.toBeInTheDocument();
    expect(screen.getByText('2 orders')).toBeInTheDocument();
  });
});

describe('OrderList Add to order', () => {
  beforeEach(() => {
    mockGetOrderList.mockReset().mockResolvedValue([entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING' })]);
    mockGetStoreInventoryItems.mockReset().mockResolvedValue([
      inventoryItem({ id: 200, name: 'Napkins', active: true }),
      inventoryItem({ id: 201, name: 'Discontinued Item', active: false }),
    ]);
  });

  it('opens the Add item panel with only active inventory items offered', async () => {
    const user = userEvent.setup();
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'Add item' }));

    expect(await screen.findByText('Add to order')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Item'));
    expect(screen.getByRole('option', { name: 'Napkins' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Discontinued Item' })).not.toBeInTheDocument();
  });

  it('adds a new entry to the table once the panel submits successfully', async () => {
    const user = userEvent.setup();
    mockCreateOrderListEntry.mockResolvedValue(
      entry({ id: 99, storeInventoryItemId: 200, itemName: 'Napkins', status: 'NEEDS_ORDERING', quantityNeeded: 1 }),
    );
    render(<OrderList storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await screen.findByText('Add to order');
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    await waitFor(() => expect(screen.queryByText('Add to order')).not.toBeInTheDocument());
    expect(screen.getByText('Napkins')).toBeInTheDocument();
  });
});
