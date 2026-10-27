import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminStockCheckHistory from './SuperAdminStockCheckHistory';
import * as superAdminStoresApi from '../api/superAdminStores';
import * as superAdminOperationsApi from '../api/superAdminOperations';
import * as stockCheckHistoryExportUtil from '../utils/stockCheckHistoryExport';
import type { SuperAdminStore } from '../types/superAdminStore';
import type { SuperAdminStockCheckHistoryPage, SuperAdminStockCheckResponse, StockCheckResponse, StockCheckStatusCounts, StockSnapshot } from '../types/stockCheck';
import { toStockCheckHistoryRowView } from '../utils/stockCheckHistoryStatus';

vi.mock('../api/superAdminStores', () => ({
  getAllStores: vi.fn(),
}));
vi.mock('../api/superAdminOperations', () => ({
  getSuperAdminStockCheckHistory: vi.fn(),
  correctSuperAdminStockCheck: vi.fn(),
}));
vi.mock('../utils/toast', () => ({
  nfToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));
vi.mock('../utils/stockCheckHistoryExport', () => ({
  buildStockCheckHistoryWorkbook: vi.fn().mockResolvedValue({}),
  buildAndDownloadStockCheckHistoryPdf: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('../utils/xlsx', () => ({
  downloadWorkbook: vi.fn().mockResolvedValue(undefined),
}));

// Same stub as StockLevelComparison.test.tsx / SuperAdminOrders.test.tsx --
// SearchableSelect is a portal-based combobox that measures real layout via
// getBoundingClientRect, which jsdom doesn't support meaningfully.
vi.mock('../components/SearchableSelect', () => ({
  default: ({ options, onChange, placeholder }: {
    options: { id: number; label: string }[];
    onChange: (ids: number[]) => void;
    placeholder: string;
  }) => (
    <select
      aria-label={placeholder}
      onChange={(event) => onChange(event.target.value === '' ? [] : [Number(event.target.value)])}
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>{option.label}</option>
      ))}
    </select>
  ),
}));

const mockGetAllStores = vi.mocked(superAdminStoresApi.getAllStores);
const mockGetHistory = vi.mocked(superAdminOperationsApi.getSuperAdminStockCheckHistory);
const mockCorrect = vi.mocked(superAdminOperationsApi.correctSuperAdminStockCheck);
const mockBuildWorkbook = vi.mocked(stockCheckHistoryExportUtil.buildStockCheckHistoryWorkbook);

function store(overrides: Partial<SuperAdminStore> = {}): SuperAdminStore {
  return {
    storeId: 1,
    storeCode: 10001,
    storeName: 'Downtown',
    storeLocation: null,
    storeActive: true,
    ownerId: 1,
    ownerName: 'Sam Owner',
    ownerActive: true,
    ownerAccessActive: true,
    employeeCount: 2,
    taskCount: 5,
    ...overrides,
  };
}

function snapshot(overrides: Partial<StockSnapshot> = {}): StockSnapshot {
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

function check(overrides: Partial<StockCheckResponse> = {}): StockCheckResponse {
  return {
    id: 1,
    storeInventoryItemId: 1,
    itemName: 'Paper Towels',
    category: 'SUPPLIES',
    unitOfMeasurement: 'EA',
    checkDate: '2026-09-20',
    requiredPar: 20,
    startOfDay: snapshot(),
    endOfDay: null,
    stockUsed: null,
    requiredTomorrow: null,
    quantityToOrder: null,
    edits: [],
    ...overrides,
  };
}

function entry(storeId: number, storeName: string, checkOverrides: Partial<StockCheckResponse> = {}): SuperAdminStockCheckResponse {
  return { storeId, storeName, check: check(checkOverrides) };
}

// Mirrors what the server returns: counts over the whole (mocked) range.
function countsFor(items: StockCheckResponse[]): StockCheckStatusCounts {
  const statuses = items.map((item) => toStockCheckHistoryRowView(item).status);
  return {
    all: items.length,
    shortage: statuses.filter((s) => s === 'shortage').length,
    sufficient: statuses.filter((s) => s === 'optimal').length,
    notCounted: statuses.filter((s) => s === 'pending').length,
  };
}

function page(overrides: Partial<SuperAdminStockCheckHistoryPage> = {}): SuperAdminStockCheckHistoryPage {
  return {
    items: [],
    page: 1,
    pageSize: 10,
    pageCount: 1,
    totalItems: 0,
    statusCounts: countsFor((overrides.items ?? []).map((entry) => entry.check)),
    ...overrides,
  };
}

beforeEach(() => {
  mockGetAllStores.mockReset().mockResolvedValue([store({ storeId: 1, storeName: 'Downtown' }), store({ storeId: 2, storeName: 'Uptown' })]);
  mockGetHistory.mockReset();
  mockCorrect.mockReset();
  mockBuildWorkbook.mockClear();
});

describe('SuperAdminStockCheckHistory', () => {
  it('renders the all-stores view with a Store column', async () => {
    mockGetHistory.mockResolvedValue(page({
      items: [
        entry(1, 'Downtown', {
          itemName: 'Paper Towels',
          startOfDay: snapshot({ lastUpdatedByAvatarUrl: 'data:image/png;base64,staff' }),
        }),
        entry(2, 'Uptown', { itemName: 'Whole Milk' }),
      ],
      totalItems: 2,
    }));

    render(<SuperAdminStockCheckHistory />);

    expect(await screen.findByRole('columnheader', { name: 'Store' })).toBeInTheDocument();
    const downtownRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    expect(within(downtownRow).getByText('Downtown')).toBeInTheDocument();
    const uptownRow = screen.getByText('Whole Milk').closest('tr')!;
    expect(within(uptownRow).getByText('Uptown')).toBeInTheDocument();
    expect(downtownRow.querySelector('.stock-check-history__store-icon')).toBeInTheDocument();
    expect(downtownRow.querySelector('.user-avatar--img')).toHaveAttribute('src', 'data:image/png;base64,staff');
    expect(downtownRow.querySelector('.stock-check-history__timestamp svg')).toBeInTheDocument();

    // storeId omitted entirely for the all-stores query.
    expect(mockGetHistory).toHaveBeenCalledWith(null, expect.any(String), expect.any(String), 1, 10, undefined);
  });

  it('selecting a store narrows the results and hides the Store column', async () => {
    const user = userEvent.setup();
    mockGetHistory.mockResolvedValueOnce(page({
      items: [entry(1, 'Downtown', { itemName: 'Paper Towels' }), entry(2, 'Uptown', { itemName: 'Whole Milk' })],
      totalItems: 2,
    }));

    render(<SuperAdminStockCheckHistory />);
    await screen.findByText('Paper Towels');

    mockGetHistory.mockResolvedValueOnce(page({
      items: [entry(1, 'Downtown', { itemName: 'Paper Towels' })],
      totalItems: 1,
    }));
    await user.selectOptions(screen.getByLabelText('All Stores'), '1');

    await waitFor(() => expect(mockGetHistory).toHaveBeenLastCalledWith(1, expect.any(String), expect.any(String), 1, 10, undefined));
    expect(await screen.findByText('Paper Towels')).toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Store' })).not.toBeInTheDocument();
    const row = screen.getByText('Paper Towels').closest('tr')!;
    expect(within(row).getByText('Downtown')).toBeInTheDocument();
    expect(row.querySelector('.stock-check-history__store-cell--mobile-only')).toBeInTheDocument();
  });

  it('clearing the store selection returns to the all-stores view', async () => {
    const user = userEvent.setup();
    mockGetHistory.mockResolvedValueOnce(page({ items: [entry(1, 'Downtown', { itemName: 'Paper Towels' })], totalItems: 1 }));

    render(<SuperAdminStockCheckHistory />);
    await screen.findByText('Paper Towels');

    mockGetHistory.mockResolvedValueOnce(page({ items: [entry(1, 'Downtown', { itemName: 'Paper Towels' })], totalItems: 1 }));
    await user.selectOptions(screen.getByLabelText('All Stores'), '1');
    await waitFor(() => expect(mockGetHistory).toHaveBeenLastCalledWith(1, expect.any(String), expect.any(String), 1, 10, undefined));

    mockGetHistory.mockResolvedValueOnce(page({
      items: [entry(1, 'Downtown', { itemName: 'Paper Towels' }), entry(2, 'Uptown', { itemName: 'Whole Milk' })],
      totalItems: 2,
    }));
    await user.selectOptions(screen.getByLabelText('All Stores'), '');

    await waitFor(() => expect(mockGetHistory).toHaveBeenLastCalledWith(null, expect.any(String), expect.any(String), 1, 10, undefined));
    expect(await screen.findByRole('columnheader', { name: 'Store' })).toBeInTheDocument();
  });

  // RTS-375: Export used to be disabled outright on "All Stores" -- it
  // should work there too, fetching across every store and tagging the
  // exported rows with a Store column so they stay attributable.
  it('exporting on the all-stores view is enabled and includes a Store column', async () => {
    const user = userEvent.setup();
    mockGetHistory.mockResolvedValue(page({
      items: [entry(1, 'Downtown', { itemName: 'Paper Towels' }), entry(2, 'Uptown', { itemName: 'Whole Milk' })],
      totalItems: 2,
    }));

    render(<SuperAdminStockCheckHistory />);
    await screen.findByText('Paper Towels');

    const exportButton = screen.getByRole('button', { name: /Export/ });
    expect(exportButton).toBeEnabled();

    await user.click(exportButton);
    await user.click(screen.getByRole('menuitem', { name: /Download Excel/ }));

    await waitFor(() => expect(mockBuildWorkbook).toHaveBeenCalled());
    const [exportedRows, , , options] = mockBuildWorkbook.mock.calls[0];
    expect(exportedRows.map((row) => row.itemName)).toEqual(['Paper Towels', 'Whole Milk']);
    expect(options).toEqual({ includeStore: true });
    // storeId omitted for the all-stores export, same as the on-screen query.
    expect(mockGetHistory).toHaveBeenCalledWith(null, expect.any(String), expect.any(String), 1, 200, undefined);
  });

  it('exporting a single selected store does not request a Store column', async () => {
    const user = userEvent.setup();
    mockGetHistory.mockResolvedValue(page({ items: [entry(1, 'Downtown', { itemName: 'Paper Towels' })], totalItems: 1 }));

    render(<SuperAdminStockCheckHistory />);
    await screen.findByText('Paper Towels');

    await user.selectOptions(screen.getByLabelText('All Stores'), '1');
    await waitFor(() => expect(mockGetHistory).toHaveBeenLastCalledWith(1, expect.any(String), expect.any(String), 1, 10, undefined));

    await user.click(screen.getByRole('button', { name: /Export/ }));
    await user.click(screen.getByRole('menuitem', { name: /Download Excel/ }));

    await waitFor(() => expect(mockBuildWorkbook).toHaveBeenCalled());
    const [, , , options] = mockBuildWorkbook.mock.calls[0];
    expect(options).toEqual({ includeStore: false });
    expect(mockGetHistory).toHaveBeenCalledWith(1, expect.any(String), expect.any(String), 1, 200, undefined);
  });

  it('a correction updates the row in place without a full refetch', async () => {
    const user = userEvent.setup();
    const original = entry(1, 'Downtown', {
      itemName: 'Paper Towels',
      startOfDay: {
        available: 48,
        deadStock: 2,
        usable: 46,
        enteredById: 1,
        enteredByName: 'John',
        enteredAt: '2026-09-20T09:00:00Z',
        lastUpdatedByName: 'John',
        lastUpdatedByAvatarUrl: null,
        lastUpdatedAt: '2026-09-20T09:00:00Z',
        edited: false,
      },
    });
    mockGetHistory.mockResolvedValue(page({ items: [original], totalItems: 1 }));
    mockCorrect.mockResolvedValue({
      ...original.check,
      startOfDay: { ...original.check.startOfDay!, available: 50, usable: 48, edited: true },
      edits: [{
        snapshot: 'START_OF_DAY',
        previousAvailable: 48,
        previousDeadStock: 2,
        newAvailable: 50,
        newDeadStock: 2,
        editedByName: 'A Super Admin',
        editedByRole: 'SUPER_ADMIN',
        editedAt: '2026-09-20T11:00:00Z',
        reason: 'Recount (count was wrong)',
      }],
    });

    render(<SuperAdminStockCheckHistory />);
    const tableRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    await user.click(within(tableRow).getByRole('button', { name: 'Correct count for Paper Towels' }));
    await screen.findByText('Correct Start of Day count: Paper Towels');

    await user.click(screen.getAllByLabelText('Increase')[0]);
    await user.click(screen.getByRole('button', { name: 'Save correction' }));

    await waitFor(() => expect(mockCorrect).toHaveBeenCalledWith(1, original.check.id, 'START_OF_DAY', 49, 2, 'Recount (count was wrong)'));
    await waitFor(() => expect(screen.queryByText('Correct Start of Day count: Paper Towels')).not.toBeInTheDocument());
    expect(mockGetHistory).toHaveBeenCalledTimes(1);
    const updatedRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    expect(within(updatedRow).getByText('48 EA')).toBeInTheDocument();
  });

  // CorrectStockCheckModal's Reason dropdown always supplies a non-blank value
  // by construction, so the mandatory-reason rule is enforced server-side --
  // this confirms that rejection surfaces inline rather than being swallowed.
  it('surfaces the server-side mandatory-reason error inline on correction failure', async () => {
    const user = userEvent.setup();
    mockGetHistory.mockResolvedValue(page({
      items: [entry(1, 'Downtown', {
        itemName: 'Paper Towels',
        startOfDay: {
          available: 48,
          deadStock: 2,
          usable: 46,
          enteredById: 1,
          enteredByName: 'John',
          enteredAt: '2026-09-20T09:00:00Z',
          lastUpdatedByName: 'John',
          lastUpdatedByAvatarUrl: null,
          lastUpdatedAt: '2026-09-20T09:00:00Z',
          edited: false,
        },
      })],
      totalItems: 1,
    }));
    mockCorrect.mockRejectedValue(new Error('A reason is required for Super Admin corrections'));

    render(<SuperAdminStockCheckHistory />);
    const tableRow = (await screen.findByText('Paper Towels')).closest('tr')!;
    await user.click(within(tableRow).getByRole('button', { name: 'Correct count for Paper Towels' }));
    await screen.findByText('Correct Start of Day count: Paper Towels');

    await user.click(screen.getAllByLabelText('Increase')[0]);
    await user.click(screen.getByRole('button', { name: 'Save correction' }));

    expect(await screen.findByText('A reason is required for Super Admin corrections')).toBeInTheDocument();
    expect(screen.getByText('Correct Start of Day count: Paper Towels')).toBeInTheDocument();
  });
});
