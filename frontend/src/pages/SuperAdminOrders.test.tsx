import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminOrders from './SuperAdminOrders';
import { ApiError } from '../api/client';
import * as superAdminStoresApi from '../api/superAdminStores';
import * as saOpsApi from '../api/superAdminOperations';
import * as inventoryItemsApi from '../api/inventoryItems';
import * as suppliersApi from '../api/suppliers';
import type { SuperAdminStore } from '../types/superAdminStore';
import type { OrderListEntry } from '../types/orderList';
import type { StoreInventoryItem } from '../types/storeInventory';

vi.mock('../api/superAdminStores', () => ({
  getAllStores: vi.fn(),
}));
vi.mock('../api/superAdminOperations', () => ({
  getOrderListForStore: vi.fn(),
  updateSuperAdminOrderStatus: vi.fn(),
  createSuperAdminOrderListEntry: vi.fn(),
  getSuperAdminInventoryCounts: vi.fn(),
  getSuperAdminInventoryCountHistory: vi.fn(),
  correctSuperAdminStockCheck: vi.fn(),
  getSuperAdminEodSupplierReport: vi.fn(),
  getSupplierPurchaseMetrics: vi.fn(),
}));
vi.mock('../api/inventoryItems', () => ({
  getAllInventoryItems: vi.fn(),
}));
vi.mock('../api/suppliers', () => ({
  getSuppliers: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

// Same stub as StockLevelComparison.test.tsx -- SearchableSelect is a
// portal-based combobox that measures real layout via getBoundingClientRect,
// which jsdom doesn't support meaningfully.
vi.mock('../components/SearchableSelect', () => ({
  default: ({ options, onChange, placeholder }: {
    options: { id: number; label: string }[];
    onChange: (ids: number[]) => void;
    placeholder: string;
  }) => (
    <select
      aria-label={placeholder}
      onChange={(event) => onChange(event.target.value === '' ? [] : [Number(event.target.value)])}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  ),
}));

const mockGetAllStores = vi.mocked(superAdminStoresApi.getAllStores);
const mockGetOrderListForStore = vi.mocked(saOpsApi.getOrderListForStore);
const mockUpdateSuperAdminOrderStatus = vi.mocked(saOpsApi.updateSuperAdminOrderStatus);
const mockCreateSuperAdminOrderListEntry = vi.mocked(saOpsApi.createSuperAdminOrderListEntry);
const mockGetSuperAdminInventoryCounts = vi.mocked(saOpsApi.getSuperAdminInventoryCounts);
const mockGetSuperAdminEodSupplierReport = vi.mocked(saOpsApi.getSuperAdminEodSupplierReport);
const mockGetSupplierPurchaseMetrics = vi.mocked(saOpsApi.getSupplierPurchaseMetrics);
const mockGetAllInventoryItems = vi.mocked(inventoryItemsApi.getAllInventoryItems);
const mockGetSuppliers = vi.mocked(suppliersApi.getSuppliers);

const STORE_ID = 10;

function store(overrides: Partial<SuperAdminStore> = {}): SuperAdminStore {
  return {
    storeId: STORE_ID,
    storeCode: 10001,
    storeName: 'Downtown',
    storeLocation: null,
    storeActive: true,
    ownerId: 1,
    ownerName: 'Sam Owner',
    ownerActive: true,
    ownerAccessActive: true,
    employeeCount: 2,
    taskCount: 5,
    ...overrides,
  };
}

function entry(overrides: Partial<OrderListEntry> = {}): OrderListEntry {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Milk',
    unitOfMeasurement: 'Gallons',
    quantityNeeded: 4,
    manualAddition: 0,
    supplierId: null,
    supplierName: null,
    note: null,
    status: 'NEEDS_ORDERING',
    adHoc: false,
    raisedByName: null,
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    imageId: null,
    ...overrides,
  };
}

function inventoryItem(overrides: Partial<StoreInventoryItem> = {}): StoreInventoryItem {
  return {
    id: 1,
    storeId: STORE_ID,
    storeName: 'Downtown',
    name: 'Milk',
    category: 'DAIRY',
    unitOfMeasurement: 'Gallons',
    minWeekday: 5,
    minWeekend: 5,
    preferredSupplierId: null,
    preferredSupplierName: null,
    note: null,
    active: true,
    autoPoEnabled: true,
    requiredToday: 5,
    currentAvailable: 10,
    imageId: null,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetAllStores.mockReset().mockResolvedValue([store()]);
  mockGetOrderListForStore.mockReset();
  mockUpdateSuperAdminOrderStatus.mockReset();
  mockCreateSuperAdminOrderListEntry.mockReset();
  mockGetSuperAdminInventoryCounts.mockReset().mockResolvedValue({
    rows: [], page: 1, size: 10, totalPages: 1, totalElements: 0, allCount: 0, outCount: 0, lowCount: 0, staleCount: 0,
  });
  mockGetSuperAdminEodSupplierReport.mockReset().mockResolvedValue({
    date: '2026-09-30', itemsNeedingOrder: 0, itemsPendingEndOfDay: 0, groups: [],
  });
  mockGetSupplierPurchaseMetrics.mockReset().mockResolvedValue([]);
  mockGetAllInventoryItems.mockReset().mockResolvedValue([]);
  mockGetSuppliers.mockReset().mockResolvedValue([]);
});

async function selectDowntown() {
  await screen.findByRole('option', { name: 'Downtown' });
  await userEvent.selectOptions(screen.getByLabelText('Select a store…'), String(STORE_ID));
}

describe('SuperAdminOrders', () => {
  it('selecting a store loads its full order list', async () => {
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Milk' }), entry({ id: 2, itemName: 'Bread', status: 'RECEIVED' })]);

    render(<SuperAdminOrders />);
    await selectDowntown();

    expect(mockGetOrderListForStore).toHaveBeenCalledWith(STORE_ID);
    expect(await screen.findByText('Milk')).toBeInTheDocument();
    // Default filter is "All open" -- Received entries are hidden until the filter changes.
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();
  });

  it('shows Received entries once the Received filter tile is picked -- this is the history view', async () => {
    mockGetOrderListForStore.mockResolvedValue([
      entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING' }),
      entry({ id: 2, itemName: 'Bread', status: 'RECEIVED' }),
    ]);

    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();

    // Switch to the flat list so an empty (and therefore collapsed-by-default)
    // supplier group can't hide the row this test is checking for.
    await userEvent.click(screen.getByRole('button', { name: 'List' }));
    await userEvent.click(screen.getByText('Received'));

    expect(await screen.findByText('Bread')).toBeInTheDocument();
    expect(screen.queryByText('Milk')).not.toBeInTheDocument();
  });

  it('changes an entry status and updates the row in place', async () => {
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Milk', status: 'NEEDS_ORDERING' })]);
    mockUpdateSuperAdminOrderStatus.mockResolvedValue(entry({ itemName: 'Milk', status: 'ORDERED' }));

    render(<SuperAdminOrders />);

    await screen.findByRole('option', { name: 'Downtown' });
    await userEvent.selectOptions(screen.getByLabelText('Select a store…'), '10');
    await screen.findByText('Milk');

    await userEvent.click(screen.getByRole('button', { name: 'Change status for Milk' }));
    await userEvent.click(screen.getByRole('option', { name: 'Ordered' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, change' }));

    await waitFor(() => expect(mockUpdateSuperAdminOrderStatus).toHaveBeenCalledWith(10, 1, 'ORDERED', 'NEEDS_ORDERING', undefined));
  });

  it('shows an "already updated" popup and refreshes the list when the Owner/Admin got there first', async () => {
    mockGetOrderListForStore
      .mockResolvedValueOnce([entry({ itemName: 'Milk', status: 'NEEDS_ORDERING' })])
      .mockResolvedValueOnce([entry({ itemName: 'Milk', status: 'ORDERED' })]);
    mockUpdateSuperAdminOrderStatus.mockRejectedValue(
      new ApiError(409, 'This item has already been updated by Admin. It is now marked as Ordered.'),
    );

    render(<SuperAdminOrders />);

    await screen.findByRole('option', { name: 'Downtown' });
    await userEvent.selectOptions(screen.getByLabelText('Select a store…'), '10');
    await screen.findByText('Milk');

    await userEvent.click(screen.getByRole('button', { name: 'Change status for Milk' }));
    await userEvent.click(screen.getByRole('option', { name: 'Ordered' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Yes, change' }));

    expect(await screen.findByText(/already been updated by Admin/)).toBeInTheDocument();
    await waitFor(() => expect(mockGetOrderListForStore).toHaveBeenCalledTimes(2));
  });

  it('opens already selected on a store when focusStore is set', async () => {
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Milk' })]);

    render(<SuperAdminOrders focusStore={{ storeId: STORE_ID, storeName: 'Downtown', ts: 1 }} />);

    expect(mockGetOrderListForStore).toHaveBeenCalledWith(STORE_ID);
    expect(await screen.findByText('Milk')).toBeInTheDocument();
  });

  it('lets a store with nothing outstanding still be selected to view its history', async () => {
    mockGetAllStores.mockResolvedValue([store({ storeId: 20, storeName: 'Uptown' })]);
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Eggs', status: 'RECEIVED' })]);

    render(<SuperAdminOrders />);

    await screen.findByRole('option', { name: 'Uptown' });
    await userEvent.selectOptions(screen.getByLabelText('Select a store…'), '20');

    expect(mockGetOrderListForStore).toHaveBeenCalledWith(20);
    // Switch to the flat list so an empty (and therefore collapsed-by-default)
    // supplier group can't hide the row this test is checking for.
    await userEvent.click(await screen.findByRole('button', { name: 'List' }));
    await userEvent.click(screen.getByText('Received'));
    expect(await screen.findByText('Eggs')).toBeInTheDocument();
  });
});

describe('SuperAdminOrders inline status change', () => {
  beforeEach(() => {
    mockGetOrderListForStore.mockReset().mockResolvedValue([entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING' })]);
  });

  it('asks for confirmation before applying a status picked from the inline dropdown', async () => {
    const user = userEvent.setup();
    mockUpdateSuperAdminOrderStatus.mockResolvedValue(entry({ id: 1, itemName: 'Milk', status: 'ORDERED' }));
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Change status for Milk'));
    await user.click(screen.getByRole('option', { name: 'Ordered' }));

    expect(mockUpdateSuperAdminOrderStatus).not.toHaveBeenCalled();
    expect(await screen.findByText('Change status?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, change' }));

    await waitFor(() => expect(mockUpdateSuperAdminOrderStatus).toHaveBeenCalledWith(STORE_ID, 1, 'ORDERED', 'NEEDS_ORDERING', undefined));
    await waitFor(() => expect(screen.queryByText('Change status?')).not.toBeInTheDocument());
  });

  it('cancels without applying anything', async () => {
    const user = userEvent.setup();
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Change status for Milk'));
    await user.click(screen.getByRole('option', { name: 'Ordered' }));
    await screen.findByText('Change status?');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Change status?')).not.toBeInTheDocument();
    expect(mockUpdateSuperAdminOrderStatus).not.toHaveBeenCalled();
  });
});

describe('SuperAdminOrders bulk selection', () => {
  beforeEach(() => {
    mockGetOrderListForStore.mockReset().mockResolvedValue([
      entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING', supplierId: null, supplierName: null }),
      entry({ id: 2, itemName: 'Bread', status: 'NEEDS_ORDERING', supplierId: null, supplierName: null }),
    ]);
  });

  it('keeps the bulk action buttons disabled until rows are selected, then confirms before marking them ordered together', async () => {
    const user = userEvent.setup();
    mockUpdateSuperAdminOrderStatus.mockImplementation((_storeId, id) =>
      Promise.resolve(entry({ id, itemName: id === 1 ? 'Milk' : 'Bread', status: 'ORDERED' })),
    );
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    expect(screen.getByRole('button', { name: 'Mark ordered' })).toBeDisabled();

    await user.click(screen.getByLabelText('Select Milk'));
    await user.click(screen.getByLabelText('Select Bread'));
    expect(screen.getByText('2 selected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark ordered' })).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Mark ordered' }));

    expect(mockUpdateSuperAdminOrderStatus).not.toHaveBeenCalled();
    expect(await screen.findByText('Mark 2 items ordered?')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Yes, mark 2 ordered' }));

    await waitFor(() => expect(mockUpdateSuperAdminOrderStatus).toHaveBeenCalledTimes(2));
    expect(mockUpdateSuperAdminOrderStatus).toHaveBeenCalledWith(STORE_ID, 1, 'ORDERED', 'NEEDS_ORDERING', undefined);
    expect(mockUpdateSuperAdminOrderStatus).toHaveBeenCalledWith(STORE_ID, 2, 'ORDERED', 'NEEDS_ORDERING', undefined);
  });

  it('skips items that are already past the target status and says so', async () => {
    mockGetOrderListForStore.mockReset().mockResolvedValue([
      entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING', supplierId: null, supplierName: null }),
      entry({ id: 2, itemName: 'Bread', status: 'ORDERED', supplierId: null, supplierName: null }),
    ]);
    const user = userEvent.setup();
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Select Milk'));
    await user.click(screen.getByLabelText('Select Bread'));
    await user.click(screen.getByRole('button', { name: 'Mark ordered' }));

    expect(await screen.findByText('Mark 1 item ordered?')).toBeInTheDocument();
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Milk')).toBeInTheDocument();
    expect(within(dialog).queryByText('Bread')).not.toBeInTheDocument();
  });

  it('copies only the selected rows via Copy selected items', async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    await user.click(screen.getByLabelText('Select Milk'));
    await user.click(screen.getByRole('button', { name: 'Copy selected items' }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain('Milk');
    expect(copied).not.toContain('Bread');
  });
});

describe('SuperAdminOrders view toggle', () => {
  beforeEach(() => {
    mockGetOrderListForStore.mockReset().mockResolvedValue([
      entry({ id: 1, itemName: 'Milk', supplierId: 1, supplierName: 'Acme Supplies', status: 'NEEDS_ORDERING' }),
      entry({ id: 2, itemName: 'Bread', supplierId: null, supplierName: null, status: 'ORDERED' }),
    ]);
  });

  it('groups entries by supplier by default, with unassigned items under "Unassigned Supplier"', async () => {
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    expect(screen.getByRole('button', { name: /Acme Supplies/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unassigned Supplier/ })).toBeInTheDocument();
  });

  it('switches to a flat list with no group headers', async () => {
    const user = userEvent.setup();
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'List' }));

    expect(screen.queryByRole('button', { name: /Acme Supplies/ })).not.toBeInTheDocument();
    expect(screen.getByText('Milk')).toBeInTheDocument();
    expect(screen.getByText('Bread')).toBeInTheDocument();
  });
});

describe('SuperAdminOrders Add to order', () => {
  beforeEach(() => {
    mockGetOrderListForStore.mockReset().mockResolvedValue([entry({ id: 1, itemName: 'Milk', status: 'NEEDS_ORDERING' })]);
    mockGetAllInventoryItems.mockReset().mockResolvedValue([
      inventoryItem({ id: 200, name: 'Napkins', active: true }),
      inventoryItem({ id: 201, name: 'Discontinued Item', active: false }),
      inventoryItem({ id: 202, name: 'Other Store Item', storeId: 999, active: true }),
    ]);
  });

  it('opens the Add item panel with only this store\'s active inventory items offered', async () => {
    const user = userEvent.setup();
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'Add item' }));

    expect(await screen.findByText('Add to order')).toBeInTheDocument();
    await user.click(screen.getByLabelText('Item'));
    expect(screen.getByRole('option', { name: 'Napkins' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Discontinued Item' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Other Store Item' })).not.toBeInTheDocument();
  });

  it('adds a new entry to the table once the panel submits successfully', async () => {
    const user = userEvent.setup();
    mockCreateSuperAdminOrderListEntry.mockResolvedValue(
      entry({ id: 99, storeInventoryItemId: 200, itemName: 'Napkins', status: 'NEEDS_ORDERING', quantityNeeded: 1 }),
    );
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'Add item' }));
    await screen.findByText('Add to order');
    await user.click(screen.getByLabelText('Item'));
    await user.click(screen.getByRole('option', { name: 'Napkins' }));
    await user.click(screen.getByLabelText('Increase'));
    await user.click(screen.getByRole('button', { name: 'Add to order list' }));

    await waitFor(() => expect(screen.queryByText('Add to order')).not.toBeInTheDocument());
    expect(mockCreateSuperAdminOrderListEntry).toHaveBeenCalledWith(STORE_ID, expect.objectContaining({ storeInventoryItemId: 200 }));
    expect(screen.getByText('Napkins')).toBeInTheDocument();
  });
});

// RTS-304 parity: the same four dashboard sub-tabs Owner/Admin's
// OrderDashboard.tsx has (see that file's own shell tests), plus the store
// picker these tabs are all scoped to.
describe('SuperAdminOrders dashboard sub-tabs', () => {
  beforeEach(() => {
    mockGetOrderListForStore.mockReset().mockResolvedValue([entry({ itemName: 'Milk' })]);
  });

  it('defaults to the Order List sub-tab', async () => {
    render(<SuperAdminOrders />);
    await selectDowntown();

    expect(screen.getByRole('button', { name: 'Order List' })).toHaveClass('order-dashboard-page__subtab--active');
    await screen.findByText('Milk');
  });

  it('switches to Inventory Counts, End of Day Report and Purchasing Summary without losing the selected store', async () => {
    const user = userEvent.setup();
    render(<SuperAdminOrders />);
    await selectDowntown();
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: 'Inventory Counts' }));
    expect(await screen.findByPlaceholderText('Search inventory')).toBeInTheDocument();
    expect(mockGetSuperAdminInventoryCounts).toHaveBeenCalledWith(STORE_ID, expect.anything());

    await user.click(screen.getByRole('button', { name: 'End of Day Report' }));
    expect(await screen.findByText('No inventory items to report for this day.')).toBeInTheDocument();
    expect(mockGetSuperAdminEodSupplierReport).toHaveBeenCalledWith(STORE_ID, expect.any(String));

    await user.click(screen.getByRole('button', { name: 'Supplier Purchasing Summary' }));
    expect(await screen.findByText('No purchasing activity found for the selected date range.')).toBeInTheDocument();
  });

  it('shows nothing on any tab until a store is picked', async () => {
    render(<SuperAdminOrders />);

    expect(screen.getByText('Select a store above to view and manage its order list.')).toBeInTheDocument();
    expect(mockGetSuperAdminInventoryCounts).not.toHaveBeenCalled();
  });
});
