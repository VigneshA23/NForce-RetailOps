import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
      metric({ storeId: 1, storeName: 'Store 1', supplierName: 'Supplier A', orderEntryCount: 8, totalQuantity: 42 }),
      metric({ storeId: 1, storeName: 'Store 1', supplierName: 'Supplier B', orderEntryCount: 3, totalQuantity: 17 }),
      metric({ storeId: 2, storeName: 'Store 2', supplierName: 'Supplier A', orderEntryCount: 5, totalQuantity: 31 }),
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
    expect(within(storeTwoRow).getByText(/31 units/)).toBeInTheDocument();

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
});
