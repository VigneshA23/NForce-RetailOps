import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminSupplierPurchaseReport from './SuperAdminSupplierPurchaseReport';
import * as superAdminOperationsApi from '../api/superAdminOperations';
import type { StoreSupplierPurchaseMetric } from '../types/orderList';

vi.mock('../api/superAdminOperations', () => ({
  getSupplierPurchaseMetrics: vi.fn(),
}));

const mockGetSupplierPurchaseMetrics = vi.mocked(superAdminOperationsApi.getSupplierPurchaseMetrics);

function metric(overrides: Partial<StoreSupplierPurchaseMetric>): StoreSupplierPurchaseMetric {
  return {
    storeId: 1,
    storeName: 'Store 1',
    supplierName: 'Supplier A',
    orderEntryCount: 8,
    totalQuantity: 42,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetSupplierPurchaseMetrics.mockReset();
});

describe('SuperAdminSupplierPurchaseReport', () => {
  it('renders an explicit empty state when nothing qualifies', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([]);

    render(<SuperAdminSupplierPurchaseReport />);

    expect(await screen.findByText('No purchasing activity found for the selected date range.')).toBeInTheDocument();
  });

  it('shows the API error message rather than pretending the report loaded', async () => {
    mockGetSupplierPurchaseMetrics.mockRejectedValue(new Error('Something went wrong'));

    render(<SuperAdminSupplierPurchaseReport />);

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
  });

  it('groups rows by store, making the store breakdown obvious without opening each one', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([
      metric({ storeId: 1, storeName: 'Store 1', supplierName: 'Supplier A', orderEntryCount: 8, totalQuantity: 42 }),
      metric({ storeId: 1, storeName: 'Store 1', supplierName: 'Supplier B', orderEntryCount: 3, totalQuantity: 17 }),
      metric({ storeId: 2, storeName: 'Store 2', supplierName: 'Supplier A', orderEntryCount: 5, totalQuantity: 31 }),
    ]);

    render(<SuperAdminSupplierPurchaseReport />);

    const storeOneHeading = (await screen.findByText('Store 1')).closest('tr')!;
    const storeOneBody = storeOneHeading.closest('tbody')!;
    expect(within(storeOneBody).getByText('Supplier A')).toBeInTheDocument();
    expect(within(storeOneBody).getByText('Supplier B')).toBeInTheDocument();

    const storeTwoHeading = screen.getByText('Store 2').closest('tr')!;
    const storeTwoBody = storeTwoHeading.closest('tbody')!;
    const storeTwoRow = within(storeTwoBody).getByText('Supplier A').closest('tr')!;
    expect(within(storeTwoRow).getByText('31')).toBeInTheDocument();
  });

  it('sorts store groups alphabetically for predictable output', async () => {
    mockGetSupplierPurchaseMetrics.mockResolvedValue([
      metric({ storeId: 2, storeName: 'Zeta Store', supplierName: 'Supplier A' }),
      metric({ storeId: 1, storeName: 'Alpha Store', supplierName: 'Supplier A' }),
    ]);

    render(<SuperAdminSupplierPurchaseReport />);
    await screen.findByText('Alpha Store');

    const text = document.body.textContent ?? '';
    expect(text.indexOf('Alpha Store')).toBeLessThan(text.indexOf('Zeta Store'));
  });
});
