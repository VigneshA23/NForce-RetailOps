import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EodSupplierReport from './EodSupplierReport';
import * as storeInventoryApi from '../api/storeInventory';
import type { EodSupplierReport as EodSupplierReportData } from '../types/stockCheck';

vi.mock('../api/storeInventory', () => ({
  getEodSupplierReport: vi.fn(),
}));

const mockGetEodSupplierReport = vi.mocked(storeInventoryApi.getEodSupplierReport);

const report: EodSupplierReportData = {
  date: '2026-09-30',
  itemsNeedingOrder: 1,
  itemsPendingEndOfDay: 1,
  groups: [
    {
      supplierId: 5,
      supplierName: 'Supplier A',
      items: [{
        storeInventoryItemId: 1,
        itemName: 'Milk',
        unitOfMeasurement: 'L',
        startOfDayAvailable: 50,
        startOfDayDeadStock: 2,
        endOfDayAvailable: 35,
        endOfDayDeadStock: 1,
        stockUsed: 14,
        requiredTomorrow: 40,
        quantityToOrder: 6,
        status: 'NEEDS_TO_ORDER',
      }],
    },
    {
      supplierId: null,
      supplierName: 'No Supplier',
      items: [{
        storeInventoryItemId: 2,
        itemName: 'Bread',
        unitOfMeasurement: 'EA',
        startOfDayAvailable: 20,
        startOfDayDeadStock: 0,
        endOfDayAvailable: null,
        endOfDayDeadStock: null,
        stockUsed: null,
        requiredTomorrow: 10,
        quantityToOrder: null,
        status: 'END_OF_DAY_PENDING',
      }],
    },
  ],
};

beforeEach(() => {
  mockGetEodSupplierReport.mockReset();
});

describe('EodSupplierReport', () => {
  it('groups rows by supplier with usage, order quantity and status', async () => {
    mockGetEodSupplierReport.mockResolvedValue(report);

    render(<EodSupplierReport />);

    const milkRow = (await screen.findByText('Milk')).closest('tr')!;
    expect(within(milkRow).getByText('14')).toBeInTheDocument();
    expect(within(milkRow).getByText('6')).toBeInTheDocument();
    expect(within(milkRow).getByText('Needs to Order')).toBeInTheDocument();

    const breadRow = screen.getByText('Bread').closest('tr')!;
    expect(within(breadRow).getByText('No Supplier')).toBeInTheDocument();
    expect(within(breadRow).getByText('EOD Pending')).toBeInTheDocument();

    expect(screen.getByText(/Supplier A/, { selector: 'th' })).toHaveTextContent('Supplier A1 item');
    expect(screen.getByText('1 to order · 1 awaiting End of Day count')).toBeInTheDocument();
  });
});
