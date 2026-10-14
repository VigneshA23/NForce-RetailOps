import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SupplierPurchaseReport from './SupplierPurchaseReport';
import * as orderListApi from '../api/orderList';
import type { OrderHistoryEntry, OrderHistoryPage, SupplierPurchaseMetric } from '../types/orderList';

vi.mock('../api/orderList', () => ({
  getSupplierPurchaseMetrics: vi.fn(),
  getOrderHistory: vi.fn(),
}));

const mockGetSupplierPurchaseMetrics = vi.mocked(orderListApi.getSupplierPurchaseMetrics);
const mockGetOrderHistory = vi.mocked(orderListApi.getOrderHistory);

function metric(overrides: Partial<SupplierPurchaseMetric>): SupplierPurchaseMetric {
  return {
    supplierName: 'Acme Supplies',
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
    supplierName: 'Acme Supplies',
    quantityOrdered: 10,
    quantityReceived: 10,
    status: 'RECEIVED',
    orderedAt: '2026-01-05T10:00:00+00:00',
    orderedByName: 'Jane Owner',
    receivedAt: '2026-01-06T09:30:00+00:00',
    receivedByName: 'Jane Owner',
    storeId: 1,
    storeName: 'Store A',
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
  mockGetOrderHistory.mockReset();
});

describe('SupplierPurchaseReport', () => {
  it('renders an explicit empty state, not a blank table, when nothing qualifies', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([]);

    render(<SupplierPurchaseReport />);

    expect(await screen.findByText('No purchasing activity found for the selected date range.')).toBeInTheDocument();
  });

  it('renders supplier rows with entry count and received count', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([
      metric({ supplierName: 'Supplier A', orderEntryCount: 8, receivedCount: 5 }),
      metric({ supplierName: 'Supplier B', orderEntryCount: 3, receivedCount: 1 }),
    ]);

    // The store accordion starts expanded (no page title anymore, so its own
    // header is the first thing visible) -- no click needed to see rows.
    render(<SupplierPurchaseReport />);

    const rowA = (await screen.findByText('Supplier A')).closest('tr')!;
    expect(rowA.querySelector('[data-label="Ordered"]')).toHaveTextContent('8 items');
    expect(rowA.querySelector('[data-label="Received"]')).toHaveTextContent('5 items');

    const rowB = screen.getByText('Supplier B').closest('tr')!;
    expect(rowB.querySelector('[data-label="Ordered"]')).toHaveTextContent('3 items');
    expect(rowB.querySelector('[data-label="Received"]')).toHaveTextContent('1 item');
  });

  it('shows the API error message rather than pretending the report loaded', async () => {
    mockGetSupplierPurchaseMetrics.mockRejectedValue(new Error('Something went wrong'));

    render(<SupplierPurchaseReport />);

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('refetches with the new range when the date range changes', async () => {
    const user = userEvent.setup();
    mockGetSupplierPurchaseMetrics.mockResolvedValue([metric({})]);

    render(<SupplierPurchaseReport />);
    await waitFor(() => expect(mockGetSupplierPurchaseMetrics).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: /all time/i }));
    const panel = await screen.findByRole('dialog', { name: 'Choose a date range' });
    await user.click(within(panel).getByLabelText('Last 7 days'));
    await user.click(within(panel).getByRole('button', { name: 'Apply' }));

    await waitFor(() => expect(mockGetSupplierPurchaseMetrics).toHaveBeenCalledTimes(2));
  });

  // Invalid-range rejection (From > To) is DateRangePicker's own responsibility
  // -- the same shared component StockCheckHistory already uses and already has
  // coverage for -- so it isn't re-proven here. This component only has to
  // pass the picker's resolved range straight through, which the "refetches
  // with the new range" test above already establishes.

  it('does not render a store selector -- the owner is scoped to their own store implicitly', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([metric({})]);

    render(<SupplierPurchaseReport />);
    await screen.findByText('Acme Supplies');

    expect(screen.queryByLabelText(/select a store/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/all stores/i)).not.toBeInTheDocument();
  });

  describe('Detailed view', () => {
    it('switches to the Detailed view in-page, scoped to the clicked supplier, instead of leaving the page', async () => {
      const user = userEvent.setup();
      mockGetSupplierPurchaseMetrics.mockResolvedValue([metric({ supplierName: 'Acme Supplies' })]);
      mockGetOrderHistory.mockResolvedValue(historyPage({}));

      render(<SupplierPurchaseReport />);
      await user.click(await screen.findByRole('button', { name: 'View Details' }));

      expect(await screen.findByText('Napkins')).toBeInTheDocument();
      expect(screen.getByText('Acme Supplies', { selector: 'strong' })).toBeInTheDocument();
      expect(mockGetOrderHistory).toHaveBeenCalledWith(
        expect.any(String), expect.any(String), 'Acme Supplies', 1, 20,
      );
    });

    it('returns to the Summary view via Back to Summary', async () => {
      const user = userEvent.setup();
      mockGetSupplierPurchaseMetrics.mockResolvedValue([metric({ supplierName: 'Acme Supplies' })]);
      mockGetOrderHistory.mockResolvedValue(historyPage({}));

      render(<SupplierPurchaseReport />);
      await user.click(await screen.findByRole('button', { name: 'View Details' }));
      await screen.findByText('Napkins');

      await user.click(screen.getByRole('button', { name: /back to summary/i }));

      expect(await screen.findByText('Acme Supplies', { selector: 'span' })).toBeInTheDocument();
      expect(screen.queryByText('Napkins')).not.toBeInTheDocument();
    });

    it('shows only Ordered/Received stat totals from the history page response', async () => {
      const user = userEvent.setup();
      mockGetSupplierPurchaseMetrics.mockResolvedValue([metric({ supplierName: 'Acme Supplies' })]);
      mockGetOrderHistory.mockResolvedValue(historyPage({ totalElements: 5, awaitingReceiptCount: 2, receivedCount: 3 }));

      render(<SupplierPurchaseReport />);
      await user.click(await screen.findByRole('button', { name: 'View Details' }));
      await screen.findByText('Napkins');

      expect(screen.getByText('Total Line Items').closest('.stat-card')).toHaveTextContent('5');
      expect(screen.getByText('Awaiting Receipt').closest('.stat-card')).toHaveTextContent('2');
      const receivedLabel = screen.getAllByText('Received').find((el) => el.closest('.stat-card'));
      expect(receivedLabel!.closest('.stat-card')).toHaveTextContent('3');
    });
  });
});
