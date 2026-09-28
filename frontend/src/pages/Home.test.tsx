import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './Home';
import * as orderListApi from '../api/orderList';
import * as issuesApi from '../api/issues';
import * as checklistHistoryApi from '../api/checklistHistory';
import * as activityApi from '../api/activity';
import type { OwnerStore } from '../types/ownerStore';

vi.mock('../api/orderList', () => ({ getNeedsOrderingCount: vi.fn() }));
vi.mock('../api/issues', () => ({ getIssues: vi.fn() }));
vi.mock('../api/checklistHistory', () => ({
  getChecklistHistorySummary: vi.fn(),
  getChecklistHistoryDetail: vi.fn(),
}));
vi.mock('../api/activity', () => ({ getRecentActivity: vi.fn() }));

const mockGetNeedsOrderingCount = vi.mocked(orderListApi.getNeedsOrderingCount);
const mockGetIssues = vi.mocked(issuesApi.getIssues);
const mockGetSummary = vi.mocked(checklistHistoryApi.getChecklistHistorySummary);
const mockGetDetail = vi.mocked(checklistHistoryApi.getChecklistHistoryDetail);
const mockGetRecentActivity = vi.mocked(activityApi.getRecentActivity);

const STORES: OwnerStore[] = [
  { id: 10, storeCode: 10001, name: 'Downtown', active: true, employeeCount: 3, taskCount: 5 },
];

function renderHome(overrides: Partial<Parameters<typeof Home>[0]> = {}) {
  return render(
    <Home
      userName="Sam Owner"
      stores={STORES}
      storesLoading={false}
      employees={[]}
      categories={[]}
      onViewStoreDetail={() => {}}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  mockGetNeedsOrderingCount.mockReset();
  mockGetIssues.mockReset().mockResolvedValue([]);
  mockGetSummary.mockReset().mockResolvedValue([]);
  mockGetDetail.mockReset().mockResolvedValue({
    storeId: 10, storeName: 'Downtown', date: '2026-09-28', hasChecklist: false, categories: [], issues: [],
  } as never);
  mockGetRecentActivity.mockReset().mockResolvedValue([]);
});

describe('Home low-stock tile', () => {
  it('renders nothing while the count is still loading', async () => {
    // Never resolves: the tile must be absent, not a placeholder, until data lands.
    mockGetNeedsOrderingCount.mockReturnValue(new Promise(() => {}));

    renderHome();

    // Wait for a tile that does render, so absence below isn't just "nothing yet".
    expect(await screen.findByText('Total Employees')).toBeInTheDocument();
    expect(screen.queryByText('Needs Ordering')).not.toBeInTheDocument();
  });

  it('renders nothing when the count is zero', async () => {
    mockGetNeedsOrderingCount.mockResolvedValue(0);

    renderHome();

    expect(await screen.findByText('Total Employees')).toBeInTheDocument();
    await waitFor(() => expect(mockGetNeedsOrderingCount).toHaveBeenCalled());
    expect(screen.queryByText('Needs Ordering')).not.toBeInTheDocument();
  });

  it('shows the count when items need ordering', async () => {
    mockGetNeedsOrderingCount.mockResolvedValue(4);

    renderHome();

    expect(await screen.findByText('Needs Ordering')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('opens the filtered Orders tab when clicked', async () => {
    mockGetNeedsOrderingCount.mockResolvedValue(2);
    const onViewPendingOrders = vi.fn();
    const user = userEvent.setup();

    renderHome({ onViewPendingOrders });

    await user.click(await screen.findByText('Needs Ordering'));

    expect(onViewPendingOrders).toHaveBeenCalledTimes(1);
  });

  it('does not give the count its own poll interval', async () => {
    mockGetNeedsOrderingCount.mockResolvedValue(1);

    renderHome();

    // One call per render pass of the shared issues effect -- if the count ever
    // gains a second interval, this and getIssues would diverge.
    await waitFor(() => expect(mockGetNeedsOrderingCount).toHaveBeenCalledTimes(1));
    expect(mockGetIssues).toHaveBeenCalledTimes(1);
  });
});
