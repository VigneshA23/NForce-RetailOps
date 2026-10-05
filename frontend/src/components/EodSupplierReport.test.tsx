import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EodSupplierReport from './EodSupplierReport';
import * as storeInventoryApi from '../api/storeInventory';
import type { EodSupplierReport as EodSupplierReportData } from '../types/stockCheck';

vi.mock('../api/storeInventory', () => ({
  getEodSupplierReport: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
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

  it('copies the report, grouped by supplier and dated by the report day, to the clipboard', async () => {
    const user = userEvent.setup();
    mockGetEodSupplierReport.mockResolvedValue(report);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    const { nfToast } = await import('../utils/toast');

    render(<EodSupplierReport storeName="Downtown" />);
    await screen.findByText('Milk');

    await user.click(screen.getByRole('button', { name: /copy report/i }));

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied.startsWith('*End of Day Report :*\n\n*Store  - Downtown*\n*Date   - September 30, 2026*')).toBe(true);
    expect(copied).toContain('Supplier A');
    expect(copied).toContain('* Milk: start 50, end 35, used 14 — order 6 L');
    expect(copied).toContain('No Supplier');
    expect(copied).toContain('* Bread: start 20, end —, used —');
    expect(nfToast.success).toHaveBeenCalledWith('Report copied to clipboard.');
  });

  it('disables the copy button while there is nothing to report', async () => {
    mockGetEodSupplierReport.mockResolvedValue({ date: '2026-09-30', itemsNeedingOrder: 0, itemsPendingEndOfDay: 0, groups: [] });

    render(<EodSupplierReport />);

    expect(await screen.findByText('No inventory items to report for this day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /copy report/i })).toBeDisabled();
  });
});
