import { render, screen } from '@testing-library/react';
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

function renderPage() {
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
    expect(screen.getByText('3 items across 1 store')).toBeInTheDocument();
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
});
