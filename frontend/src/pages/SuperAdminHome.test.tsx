import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SuperAdminHome from './SuperAdminHome';
import * as saOpsApi from '../api/superAdminOperations';
import * as activityApi from '../api/activity';
import type { OutstandingOrdersOverview, StoreOutstandingOrdersRow } from '../api/superAdminOperations';

vi.mock('../api/superAdminOperations', () => ({
  getPlatformStats: vi.fn(),
  getOperationsOverview: vi.fn(),
  getPlatformTrend: vi.fn(),
  getOutstandingOrders: vi.fn(),
  getOrderListForStore: vi.fn(),
  updateSuperAdminOrderStatus: vi.fn(),
}));
vi.mock('../api/activity', () => ({ getRecentActivity: vi.fn() }));

const mockGetPlatformStats = vi.mocked(saOpsApi.getPlatformStats);
const mockGetOperationsOverview = vi.mocked(saOpsApi.getOperationsOverview);
const mockGetPlatformTrend = vi.mocked(saOpsApi.getPlatformTrend);
const mockGetOutstandingOrders = vi.mocked(saOpsApi.getOutstandingOrders);
const mockGetRecentActivity = vi.mocked(activityApi.getRecentActivity);

function row(overrides: Partial<StoreOutstandingOrdersRow>): StoreOutstandingOrdersRow {
  return {
    storeId: 1,
    storeCode: 10001,
    storeName: 'Downtown',
    ownerName: 'Sam Owner',
    outstandingCount: 3,
    oldestOutstandingAt: '2026-09-20T09:00:00Z',
    ...overrides,
  };
}

function overview(overrides: Partial<OutstandingOrdersOverview> = {}): OutstandingOrdersOverview {
  return {
    platformOutstandingCount: 3,
    storesWithOutstanding: 1,
    truncated: false,
    stores: [row({})],
    ...overrides,
  };
}

function renderPage(overrides: { onViewStoreOrders?: (storeId: number, storeName: string) => void; onOrdersClick?: () => void } = {}) {
  return render(
    <SuperAdminHome
      userName="Ada Admin"
      owners={[]}
      ownersLoading={false}
      totalStoreCount={0}
      totalCategoryCount={0}
      onStoreClick={() => {}}
      onIssuesClick={() => {}}
      onOwnersClick={() => {}}
      onStoresClick={() => {}}
      onCategoriesClick={() => {}}
      onChecklistClick={() => {}}
      onViewAllActivity={() => {}}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  mockGetPlatformStats.mockReset().mockResolvedValue({
    platformCompletionPercent: 0, totalOpenIssues: 0, totalStores: 0, storesWithActivity: 0,
    totalTasksToday: 0, completedTasksToday: 0, totalEmployees: 0, employeesActiveToday: 0,
    storesWithOpenIssues: 0, totalOwners: 0, ownersLoggedInToday: 0,
  });
  mockGetOperationsOverview.mockReset().mockResolvedValue([]);
  mockGetPlatformTrend.mockReset().mockResolvedValue([]);
  mockGetOutstandingOrders.mockReset();
  mockGetRecentActivity.mockReset().mockResolvedValue([]);
});

describe('SuperAdminHome outstanding orders', () => {
  it('renders the platform total and a per-store row', async () => {
    mockGetOutstandingOrders.mockResolvedValue(overview());

    renderPage();

    expect(await screen.findByText('Outstanding Orders')).toBeInTheDocument();
    expect(screen.getByText('1 store affected')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View all 3 outstanding orders' })).toBeInTheDocument();
    expect(screen.getByText('Downtown')).toBeInTheDocument();
    expect(screen.getByText(/#10001 · Sam Owner/)).toBeInTheDocument();
  });

  it('renders an ownerless store as Unassigned', async () => {
    mockGetOutstandingOrders.mockResolvedValue(
      overview({ stores: [row({ ownerName: 'Unassigned' })] }),
    );

    renderPage();

    expect(await screen.findByText(/Unassigned/)).toBeInTheDocument();
  });

  it('says how many stores were omitted when the list is capped', async () => {
    mockGetOutstandingOrders.mockResolvedValue(
      overview({
        platformOutstandingCount: 137,
        storesWithOutstanding: 62,
        truncated: true,
        stores: [row({})],
      }),
    );

    renderPage();

    expect(await screen.findByText(/Showing the 1 stores with the most outstanding items, of 62\./))
      .toBeInTheDocument();
  });

  it('renders nothing when there is nothing outstanding', async () => {
    mockGetOutstandingOrders.mockResolvedValue(
      overview({ platformOutstandingCount: 0, storesWithOutstanding: 0, stores: [] }),
    );

    renderPage();

    // Wait for a section that always renders, so absence is a real assertion.
    expect(await screen.findByText('Store Performance')).toBeInTheDocument();
    expect(screen.queryByText('Outstanding Orders')).not.toBeInTheDocument();
  });

  it('fetches once on mount with no poll of its own', async () => {
    mockGetOutstandingOrders.mockResolvedValue(overview());

    renderPage();

    expect(await screen.findByText('Outstanding Orders')).toBeInTheDocument();
    expect(mockGetOutstandingOrders).toHaveBeenCalledTimes(1);
  });

  it('clicking a store row opens the Orders tab pre-selected on that store', async () => {
    mockGetOutstandingOrders.mockResolvedValue(overview());
    const onViewStoreOrders = vi.fn();

    renderPage({ onViewStoreOrders });
    await screen.findByText('Downtown');
    await userEvent.click(screen.getByRole('button', { name: /Downtown/ }));

    expect(onViewStoreOrders).toHaveBeenCalledWith(1, 'Downtown');
  });

  it('"View all" opens the Orders tab with no store pre-selected', async () => {
    mockGetOutstandingOrders.mockResolvedValue(overview());
    const onOrdersClick = vi.fn();

    renderPage({ onOrdersClick });
    await screen.findByText('Outstanding Orders');
    await userEvent.click(screen.getByRole('button', { name: 'View all 3 outstanding orders' }));

    expect(onOrdersClick).toHaveBeenCalled();
  });

  it('lists stores oldest-first, counting red only once the oldest order is 3+ days old', async () => {
    const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    mockGetOutstandingOrders.mockResolvedValue(
      overview({
        platformOutstandingCount: 8,
        storesWithOutstanding: 2,
        stores: [
          row({ storeId: 1, storeName: 'Fresh', outstandingCount: 2, oldestOutstandingAt: daysAgo(0) }),
          row({ storeId: 2, storeName: 'Stale', outstandingCount: 6, oldestOutstandingAt: daysAgo(5) }),
        ],
      }),
    );

    renderPage();
    await screen.findByText('Stale');

    const rows = screen.getAllByRole('button', { name: /Oldest outstanding/ });
    expect(rows.map((r) => within(r).getByText(/Fresh|Stale/).textContent)).toEqual(['Stale', 'Fresh']);
    expect(within(rows[0]).getByText('6')).toHaveClass('sa-home__orders-count--overdue');
    expect(within(rows[1]).getByText('2')).not.toHaveClass('sa-home__orders-count--overdue');
  });
});
