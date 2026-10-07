import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import EmployeeStockCheckHistory from './EmployeeStockCheckHistory';
import * as stockChecksApi from '../api/stockChecks';
import type { StockCheckHistoryPage, StockCheckResponse, StockSnapshot } from '../types/stockCheck';

vi.mock('../api/stockChecks', () => ({
  getEmployeeStockCheckHistory: vi.fn(),
}));

const mockGetEmployeeStockCheckHistory = vi.mocked(stockChecksApi.getEmployeeStockCheckHistory);

function snapshot(overrides: Partial<StockSnapshot>): StockSnapshot {
  return {
    available: 12,
    deadStock: 0,
    usable: 12,
    enteredByName: 'Jane Doe',
    enteredAt: '2026-09-20T09:00:00Z',
    lastUpdatedByName: 'Jane Doe',
    lastUpdatedAt: '2026-09-20T09:00:00Z',
    edited: false,
    ...overrides,
  };
}

function row(overrides: Partial<StockCheckResponse>): StockCheckResponse {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Paper Towels',
    category: 'SUPPLIES',
    unitOfMeasurement: 'EA',
    checkDate: '2026-09-20',
    requiredPar: 20,
    startOfDay: snapshot({}),
    endOfDay: null,
    stockUsed: null,
    requiredTomorrow: null,
    quantityToOrder: null,
    edits: [],
    ...overrides,
  };
}

function page(overrides: Partial<StockCheckHistoryPage>): StockCheckHistoryPage {
  return {
    items: [],
    page: 1,
    pageSize: 50,
    pageCount: 1,
    totalItems: 0,
    ...overrides,
  };
}

beforeEach(() => {
  mockGetEmployeeStockCheckHistory.mockReset();
});

describe('EmployeeStockCheckHistory', () => {
  it('shows who recorded the count', async () => {
    mockGetEmployeeStockCheckHistory.mockResolvedValue(page({
      items: [row({ startOfDay: snapshot({ lastUpdatedByName: 'Jane Doe' }) })],
      totalItems: 1,
    }));

    render(<EmployeeStockCheckHistory storeId={1} />);

    expect(await screen.findByText(/Recorded by Jane Doe/)).toBeInTheDocument();
  });

  it('shows a Corrected indicator when the row has edit history, and omits it otherwise', async () => {
    mockGetEmployeeStockCheckHistory.mockResolvedValue(page({
      items: [
        row({
          id: 1,
          itemName: 'Paper Towels',
          edits: [{
            snapshot: 'START_OF_DAY',
            previousAvailable: 10,
            previousDeadStock: 0,
            newAvailable: 12,
            newDeadStock: 0,
            editedByName: 'Owner Olivia',
            editedAt: '2026-09-20T10:00:00Z',
            reason: 'Recount',
          }],
        }),
        row({ id: 2, itemName: 'Napkins', edits: [] }),
      ],
      totalItems: 2,
    }));

    render(<EmployeeStockCheckHistory storeId={1} />);

    const correctedItem = (await screen.findByText('Paper Towels')).closest('article')!;
    expect(correctedItem.textContent).toContain('Corrected');

    const uncorrectedItem = screen.getByText('Napkins').closest('article')!;
    expect(uncorrectedItem.textContent).not.toContain('Corrected');
  });
});
