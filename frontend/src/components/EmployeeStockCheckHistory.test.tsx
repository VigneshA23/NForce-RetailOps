import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
    enteredById: 1,
    enteredByName: 'Jane Doe',
    enteredAt: '2026-09-20T09:00:00Z',
    lastUpdatedByName: 'Jane Doe',
    lastUpdatedByAvatarUrl: null,
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

    const tableRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    expect(tableRow.querySelector('[data-label="Recorded By"]')).toHaveTextContent('Jane Doe');
  });

  it('labels a par deficit as a shortage', async () => {
    mockGetEmployeeStockCheckHistory.mockResolvedValue(page({
      items: [row({ endOfDay: snapshot({ available: 16, usable: 16 }) })],
      totalItems: 1,
    }));

    render(<EmployeeStockCheckHistory storeId={1} />);

    expect(await screen.findByText('+4 EA needed')).toBeInTheDocument();
  });

  it('uses the Sufficient filter only for optimal records, excluding not-counted and shortage items', async () => {
    const user = userEvent.setup();
    mockGetEmployeeStockCheckHistory.mockResolvedValue(page({
      items: [
        row({ id: 1, itemName: 'Pending Item' }),
        row({
          id: 2,
          itemName: 'Sufficient Item',
          endOfDay: snapshot({ available: 20, usable: 20 }),
        }),
        row({
          id: 3,
          itemName: 'Shortage Item',
          endOfDay: snapshot({ available: 16, usable: 16 }),
        }),
      ],
      totalItems: 3,
    }));

    render(<EmployeeStockCheckHistory storeId={1} />);

    await user.click(await screen.findByRole('button', { name: /Sufficient/ }));

    expect(screen.queryByText('Pending Item')).not.toBeInTheDocument();
    expect(screen.getByText('Sufficient Item')).toBeInTheDocument();
    expect(screen.queryByText('Shortage Item')).not.toBeInTheDocument();
    expect(screen.getByText('Sufficient')).toBeInTheDocument();
  });

  it('shows the shared row fields without correction actions for employees', async () => {
    mockGetEmployeeStockCheckHistory.mockResolvedValue(page({
      items: [
        row({
          id: 1,
          itemName: 'Paper Towels',
          startOfDay: snapshot({ lastUpdatedByName: 'Owner Olivia' }),
          edits: [{
            snapshot: 'START_OF_DAY',
            previousAvailable: 10,
            previousDeadStock: 0,
            newAvailable: 12,
            newDeadStock: 0,
            editedByName: 'Owner Olivia',
            editedByRole: 'STORE_USER',
            editedAt: '2026-09-20T10:00:00Z',
            reason: 'Recount',
          }],
        }),
        row({ id: 2, itemName: 'Napkins', edits: [] }),
      ],
      totalItems: 2,
    }));

    render(<EmployeeStockCheckHistory storeId={1} />);

    const tableRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    expect(tableRow.querySelector('[data-label="Recorded By"]')).toHaveTextContent('Owner Olivia');
    expect(tableRow.querySelector('[data-label="Actions"]')).not.toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Count Entered' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Qty Needed (Par Reconciled)' })).toBeInTheDocument();
  });
});
