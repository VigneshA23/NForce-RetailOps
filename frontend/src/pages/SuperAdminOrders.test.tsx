import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminOrders from './SuperAdminOrders';
import * as superAdminStoresApi from '../api/superAdminStores';
import * as saOpsApi from '../api/superAdminOperations';
import type { SuperAdminStore } from '../types/superAdminStore';
import type { OutstandingOrdersOverview } from '../api/superAdminOperations';
import type { OrderListEntry } from '../types/orderList';

vi.mock('../api/superAdminStores', () => ({
  getAllStores: vi.fn(),
}));
vi.mock('../api/superAdminOperations', () => ({
  getOutstandingOrders: vi.fn(),
  getOrderListForStore: vi.fn(),
  updateSuperAdminOrderStatus: vi.fn(),
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
const mockGetOutstandingOrders = vi.mocked(saOpsApi.getOutstandingOrders);
const mockGetOrderListForStore = vi.mocked(saOpsApi.getOrderListForStore);
const mockUpdateSuperAdminOrderStatus = vi.mocked(saOpsApi.updateSuperAdminOrderStatus);

function store(overrides: Partial<SuperAdminStore> = {}): SuperAdminStore {
  return {
    storeId: 10,
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

function overview(overrides: Partial<OutstandingOrdersOverview> = {}): OutstandingOrdersOverview {
  return {
    platformOutstandingCount: 0,
    storesWithOutstanding: 0,
    truncated: false,
    stores: [],
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

beforeEach(() => {
  mockGetAllStores.mockReset().mockResolvedValue([store()]);
  mockGetOutstandingOrders.mockReset().mockResolvedValue(overview());
  mockGetOrderListForStore.mockReset();
  mockUpdateSuperAdminOrderStatus.mockReset();
});

describe('SuperAdminOrders', () => {
  it('shows the cross-store outstanding summary and selecting a store row loads its full order list', async () => {
    mockGetOutstandingOrders.mockResolvedValue(overview({
      platformOutstandingCount: 3,
      storesWithOutstanding: 1,
      stores: [{ storeId: 10, storeCode: 10001, storeName: 'Downtown', ownerName: 'Sam Owner', outstandingCount: 3, oldestOutstandingAt: '2026-09-20T09:00:00Z' }],
    }));
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Milk' }), entry({ id: 2, itemName: 'Bread', status: 'RECEIVED' })]);

    render(<SuperAdminOrders />);

    expect(await screen.findByText('3 items across 1 store')).toBeInTheDocument();
    // The overview row is a button -- disambiguates from the store picker's
    // <option value="10">Downtown</option>, which has the same text.
    await userEvent.click(screen.getByRole('button', { name: /Downtown/ }));

    expect(mockGetOrderListForStore).toHaveBeenCalledWith(10);
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

    await screen.findByRole('option', { name: 'Downtown' });
    await userEvent.selectOptions(screen.getByLabelText('Select a store…'), '10');
    await screen.findByText('Milk');
    expect(screen.queryByText('Bread')).not.toBeInTheDocument();

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

    await waitFor(() => expect(mockUpdateSuperAdminOrderStatus).toHaveBeenCalledWith(10, 1, 'ORDERED'));
  });

  it('opens already selected on a store when focusStore is set', async () => {
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Milk' })]);

    render(<SuperAdminOrders focusStore={{ storeId: 10, storeName: 'Downtown', ts: 1 }} />);

    expect(mockGetOrderListForStore).toHaveBeenCalledWith(10);
    expect(await screen.findByText('Milk')).toBeInTheDocument();
  });

  it('lets a store with nothing outstanding still be selected to view its history', async () => {
    mockGetAllStores.mockResolvedValue([store({ storeId: 20, storeName: 'Uptown' })]);
    mockGetOutstandingOrders.mockResolvedValue(overview());
    mockGetOrderListForStore.mockResolvedValue([entry({ itemName: 'Eggs', status: 'RECEIVED' })]);

    render(<SuperAdminOrders />);

    await screen.findByRole('option', { name: 'Uptown' });
    await userEvent.selectOptions(screen.getByLabelText('Select a store…'), '20');

    expect(mockGetOrderListForStore).toHaveBeenCalledWith(20);
    await userEvent.click(await screen.findByText('Received'));
    expect(await screen.findByText('Eggs')).toBeInTheDocument();
  });
});
