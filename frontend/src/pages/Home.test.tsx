import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Home from './Home';
import * as orderListApi from '../api/orderList';
import * as issuesApi from '../api/issues';
import * as checklistHistoryApi from '../api/checklistHistory';
import * as activityApi from '../api/activity';
import type { OwnerStore } from '../types/ownerStore';
import type { Issue } from '../types/issue';

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

const OPEN_ISSUE: Issue = {
  id: 1, storeId: 10, storeName: 'Downtown', employeeUserId: 2,
  employeeFullName: 'Alex', note: 'Freezer is noisy', status: 'OPEN',
  raisedDate: '2026-09-28', responseText: null, respondedByFullName: null,
  respondedBySuperAdmin: false, respondedAt: null, createdAt: '2026-09-28T09:00:00Z',
};

// Returns the `stat-card--<tone>` class of every tile in the stat row.
function toneClasses(): string[] {
  const row = document.querySelector('.stat-card-row');
  return Array.from(row?.querySelectorAll('.stat-card') ?? []).map((el) => {
    const tone = Array.from(el.classList).find(
      (c) => c.startsWith('stat-card--') && c !== 'stat-card--active',
    );
    return tone ?? '(none)';
  });
}

// The Home row renders five tiles against what used to be four tones, so two of
// them shared: Needs Ordering and Active Issues both came out `primary` and read
// as a single block of red. These pin the fix.
describe('Home stat tile tones', () => {
  it('does not give Needs Ordering and Active Issues the same tone', async () => {
    mockGetNeedsOrderingCount.mockResolvedValue(3);
    mockGetIssues.mockResolvedValue([OPEN_ISSUE]);

    renderHome();

    // Both alert tiles on screen at once -- the exact reported state.
    const lowStock = (await screen.findByText('Needs Ordering')).closest('.stat-card');
    const issues = screen.getByText('Active Issues').closest('.stat-card');
    await waitFor(() => expect(screen.getByText('3')).toBeInTheDocument());

    const toneOf = (el: Element | null) =>
      Array.from(el?.classList ?? []).find((c) => c.startsWith('stat-card--'));

    expect(toneOf(lowStock)).toBeDefined();
    expect(toneOf(lowStock)).not.toBe(toneOf(issues));
  });

  // The general invariant, and the one that actually broke: a tile reusing a
  // tone already spent elsewhere in the row is invisible as a distinct thing.
  // This fails for any future tile that collides, not just these two.
  it('gives every tile in the row a distinct tone', async () => {
    mockGetNeedsOrderingCount.mockResolvedValue(3);
    mockGetIssues.mockResolvedValue([OPEN_ISSUE]);

    renderHome();

    await screen.findByText('Needs Ordering');
    await waitFor(() => expect(toneClasses().length).toBe(5));

    const tones = toneClasses();
    expect(new Set(tones).size).toBe(tones.length);
  });
});
