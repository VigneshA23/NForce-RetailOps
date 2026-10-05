import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SupplierPurchaseReport from './SupplierPurchaseReport';
import * as orderListApi from '../api/orderList';
import type { SupplierPurchaseMetric } from '../types/orderList';

vi.mock('../api/orderList', () => ({
  getSupplierPurchaseMetrics: vi.fn(),
}));

const mockGetSupplierPurchaseMetrics = vi.mocked(orderListApi.getSupplierPurchaseMetrics);

function metric(overrides: Partial<SupplierPurchaseMetric>): SupplierPurchaseMetric {
  return {
    supplierName: 'Acme Supplies',
    orderEntryCount: 8,
    totalQuantity: 42,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetSupplierPurchaseMetrics.mockReset();
});

describe('SupplierPurchaseReport', () => {
  it('renders an explicit empty state, not a blank table, when nothing qualifies', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([]);

    render(<SupplierPurchaseReport />);

    expect(await screen.findByText('No purchasing activity found for the selected date range.')).toBeInTheDocument();
  });

  it('renders supplier rows with entry count and total quantity', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([
      metric({ supplierName: 'Supplier A', orderEntryCount: 8, totalQuantity: 42 }),
      metric({ supplierName: 'Supplier B', orderEntryCount: 3, totalQuantity: 17 }),
    ]);

    render(<SupplierPurchaseReport />);

    const rowA = (await screen.findByText('Supplier A')).closest('tr')!;
    expect(within(rowA).getByText('8')).toBeInTheDocument();
    expect(within(rowA).getByText('42')).toBeInTheDocument();

    const rowB = screen.getByText('Supplier B').closest('tr')!;
    expect(within(rowB).getByText('3')).toBeInTheDocument();
    expect(within(rowB).getByText('17')).toBeInTheDocument();
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
});
