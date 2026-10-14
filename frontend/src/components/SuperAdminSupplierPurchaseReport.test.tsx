import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminSupplierPurchaseReport from './SuperAdminSupplierPurchaseReport';
import * as superAdminOperationsApi from '../api/superAdminOperations';
import type { OrderHistoryEntry, OrderHistoryPage, StoreSupplierPurchaseMetric } from '../types/orderList';

vi.mock('../api/superAdminOperations', () => ({
  getSupplierPurchaseMetrics: vi.fn(),
  getOrderHistoryForStore: vi.fn(),
}));

const mockGetSupplierPurchaseMetrics = vi.mocked(superAdminOperationsApi.getSupplierPurchaseMetrics);
const mockGetOrderHistoryForStore = vi.mocked(superAdminOperationsApi.getOrderHistoryForStore);

function metric(overrides: Partial<StoreSupplierPurchaseMetric>): StoreSupplierPurchaseMetric {
  return {
    storeId: 1,
    storeName: 'Store 1',
    supplierName: 'Supplier A',
    orderEntryCount: 8,
    totalQuantity: 42,
    receivedCount: 5,
    ...overrides,
  };
}

function historyEntry(overrides: Partial<OrderHistoryEntry>): OrderHistoryEntry {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Napkins',
    category: 'SUPPLIES',
    unitOfMeasurement: 'pack',
    imageId: null,
    supplierId: 1,
    supplierName: 'Supplier A',
    quantityOrdered: 10,
    quantityReceived: 10,
    status: 'RECEIVED',
    orderedAt: '2026-01-05T10:00:00+00:00',
    orderedByName: 'Super Admin',
    receivedAt: '2026-01-06T09:30:00+00:00',
    receivedByName: 'Super Admin',
    storeId: 1,
    storeName: 'Store 1',
    ...overrides,
  };
}

function historyPage(overrides: Partial<OrderHistoryPage>): OrderHistoryPage {
  return {
    rows: [historyEntry({})],
    page: 1,
    size: 20,
    totalPages: 1,
    totalElements: 1,
    awaitingReceiptCount: 0,
    receivedCount: 1,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetSupplierPurchaseMetrics.mockReset();
  mockGetOrderHistoryForStore.mockReset();
});

describe('SuperAdminSupplierPurchaseReport', () => {
  it('renders an explicit empty state when nothing qualifies', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([]);

    render(<SuperAdminSupplierPurchaseReport selectedStoreId={null} />);

    expect(await screen.findByText('No purchasing activity found for the selected date range.')).toBeInTheDocument();
  });

  it('shows the API error message rather than pretending the report loaded', async () => {
    mockGetSupplierPurchaseMetrics.mockRejectedValue(new Error('Something went wrong'));

    render(<SuperAdminSupplierPurchaseReport selectedStoreId={null} />);

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('groups rows by store, each behind its own accordion header, expanded by default', async () => {
    const user = userEvent.setup();
    mockGetSupplierPurchaseMetrics.mockResolvedValue([
      metric({ storeId: 1, storeName: 'Store 1', supplierName: 'Supplier A', orderEntryCount: 8, receivedCount: 5 }),
      metric({ storeId: 1, storeName: 'Store 1', supplierName: 'Supplier B', orderEntryCount: 3, receivedCount: 1 }),
      metric({ storeId: 2, storeName: 'Store 2', supplierName: 'Supplier A', orderEntryCount: 5, receivedCount: 4 }),
    ]);

    render(<SuperAdminSupplierPurchaseReport selectedStoreId={null} />);

    const storeOneHeader = await screen.findByRole('button', { name: /Store 1/i });
    const storeTwoHeader = screen.getByRole('button', { name: /Store 2/i });
    expect(storeOneHeader).toHaveAttribute('aria-expanded', 'true');
    expect(storeTwoHeader).toHaveAttribute('aria-expanded', 'true');

    const storeOneBody = storeOneHeader.closest('.store-accordion-group') as HTMLElement;
    expect(within(storeOneBody).getByText('Supplier A')).toBeInTheDocument();
    expect(within(storeOneBody).getByText('Supplier B')).toBeInTheDocument();

    const storeTwoBody = storeTwoHeader.closest('.store-accordion-group') as HTMLElement;
    const storeTwoRow = within(storeTwoBody).getByText('Supplier A').closest('tr')!;
    expect(storeTwoRow.querySelector('[data-label="Received"]')).toHaveTextContent('4 items');

    // Collapsing one store's group leaves the other one alone.
    await user.click(storeOneHeader);
    expect(storeOneHeader).toHaveAttribute('aria-expanded', 'false');
    expect(within(storeOneBody).queryByText('Supplier A')).not.toBeInTheDocument();
    expect(storeTwoHeader).toHaveAttribute('aria-expanded', 'true');
  });

  it('narrows to the selected store (the page-level store picker), no filter of its own', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([
      metric({ storeId: 1, storeName: 'Store 1', supplierName: 'Supplier A' }),
      metric({ storeId: 2, storeName: 'Store 2', supplierName: 'Supplier B' }),
    ]);

    render(<SuperAdminSupplierPurchaseReport selectedStoreId={2} />);

    await screen.findByRole('button', { name: /Store 2/i });
    expect(screen.queryByRole('button', { name: /Store 1/i })).not.toBeInTheDocument();
  });

  it('sorts store groups alphabetically for predictable output', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([
      metric({ storeId: 2, storeName: 'Zeta Store', supplierName: 'Supplier A' }),
      metric({ storeId: 1, storeName: 'Alpha Store', supplierName: 'Supplier A' }),
    ]);

    render(<SuperAdminSupplierPurchaseReport selectedStoreId={null} />);
    await screen.findByText('Alpha Store');

    const text = document.body.textContent ?? '';
    expect(text.indexOf('Alpha Store')).toBeLessThan(text.indexOf('Zeta Store'));
  });

  describe('Detailed view', () => {
    it('switches to the Detailed view in-page, scoped to the clicked row\'s store and supplier', async () => {
      const user = userEvent.setup();
      mockGetSupplierPurchaseMetrics.mockResolvedValue([
        metric({ storeId: 1, storeName: 'Store 1', supplierName: 'Supplier A' }),
      ]);
      mockGetOrderHistoryForStore.mockResolvedValue(historyPage({}));

      render(<SuperAdminSupplierPurchaseReport selectedStoreId={null} />);
      await user.click(await screen.findByRole('button', { name: 'View Details' }));

      expect(await screen.findByText('Napkins')).toBeInTheDocument();
      expect(mockGetOrderHistoryForStore).toHaveBeenCalledWith(
        1, expect.any(String), expect.any(String), 'Supplier A', 1, 20,
      );
    });

    it('returns to the Summary view via Back to Summary', async () => {
      const user = userEvent.setup();
      mockGetSupplierPurchaseMetrics.mockResolvedValue([
        metric({ storeId: 1, storeName: 'Store 1', supplierName: 'Supplier A' }),
      ]);
      mockGetOrderHistoryForStore.mockResolvedValue(historyPage({}));

      render(<SuperAdminSupplierPurchaseReport selectedStoreId={null} />);
      await user.click(await screen.findByRole('button', { name: 'View Details' }));
      await screen.findByText('Napkins');

      await user.click(screen.getByRole('button', { name: /back to summary/i }));

      expect(await screen.findByRole('button', { name: /Store 1/i })).toBeInTheDocument();
      expect(screen.queryByText('Napkins')).not.toBeInTheDocument();
    });
  });
});
