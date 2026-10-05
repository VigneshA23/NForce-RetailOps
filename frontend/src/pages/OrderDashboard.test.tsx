import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import OrderDashboard from './OrderDashboard';
import * as orderListApi from '../api/orderList';
import * as suppliersApi from '../api/suppliers';
import * as storeInventoryApi from '../api/storeInventory';

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
  getInventoryCountHistory: vi.fn(),
  correctStockCheck: vi.fn(),
  getEodSupplierReport: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

beforeEach(() => {
  vi.mocked(orderListApi.getOrderList).mockReset().mockResolvedValue([]);
  vi.mocked(suppliersApi.getOwnerSuppliers).mockReset().mockResolvedValue([]);
  vi.mocked(storeInventoryApi.getStoreInventoryItems).mockReset().mockResolvedValue([]);
  vi.mocked(storeInventoryApi.getInventoryCounts).mockReset().mockResolvedValue({
    rows: [], page: 1, size: 10, totalPages: 1, totalElements: 0, allCount: 0, outCount: 0, lowCount: 0, staleCount: 0,
  });
  vi.mocked(storeInventoryApi.getEodSupplierReport).mockReset().mockResolvedValue({
    date: '2026-09-30', itemsNeedingOrder: 0, itemsPendingEndOfDay: 0, groups: [],
  });
});

describe('OrderDashboard shell', () => {
  it('defaults to the Order List sub-tab', async () => {
    render(<OrderDashboard storeName="Downtown" />);

    expect(screen.getByRole('button', { name: 'Order List' })).toHaveClass('order-dashboard-page__subtab--active');
    await screen.findByPlaceholderText('Search items');
  });

  it('switches to Inventory Counts and End of Day Report without remounting on every click', async () => {
    const user = userEvent.setup();
    render(<OrderDashboard storeName="Downtown" />);
    await screen.findByPlaceholderText('Search items');

    await user.click(screen.getByRole('button', { name: 'Inventory Counts' }));
    expect(await screen.findByPlaceholderText('Search inventory')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'End of Day Report' }));
    expect(await screen.findByText('No inventory items to report for this day.')).toBeInTheDocument();
  });

  // Arriving from the Home low-stock tile always lands on Order List, even if
  // another sub-tab happened to be active, since that's the only tab the
  // seed's status filter applies to.
  it('jumps to Order List when a fresh seed arrives on another sub-tab', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OrderDashboard storeName="Downtown" />);
    await screen.findByPlaceholderText('Search items');

    await user.click(screen.getByRole('button', { name: 'Inventory Counts' }));
    await screen.findByPlaceholderText('Search inventory');

    rerender(<OrderDashboard storeName="Downtown" seed={{ status: 'NEEDS_ORDERING', id: 1 }} />);

    expect(await screen.findByPlaceholderText('Search items')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Order List' })).toHaveClass('order-dashboard-page__subtab--active');
  });
});
