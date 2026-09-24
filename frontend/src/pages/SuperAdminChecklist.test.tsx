import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import SuperAdminChecklist from './SuperAdminChecklist';
import * as checklistHistoryApi from '../api/checklistHistory';
import * as superAdminStoresApi from '../api/superAdminStores';
import * as superAdminOperationsApi from '../api/superAdminOperations';
import { todayDate, previousCalendarWeekRange, datesInRange } from '../utils/checklistHistoryOptions';
import type { ChecklistHistoryDetail, ChecklistHistoryTaskItem } from '../types/checklistHistory';

vi.mock('../api/checklistHistory', () => ({
  getChecklistHistoryDetail: vi.fn(),
}));

vi.mock('../api/superAdminStores', () => ({
  getAllStores: vi.fn(),
}));

vi.mock('../api/superAdminOperations', () => ({
  getStoreTrend: vi.fn(),
}));

const mockGetDetail = vi.mocked(checklistHistoryApi.getChecklistHistoryDetail);
const mockGetAllStores = vi.mocked(superAdminStoresApi.getAllStores);
const mockGetStoreTrend = vi.mocked(superAdminOperationsApi.getStoreTrend);

function taskItem(overrides: Partial<ChecklistHistoryTaskItem>): ChecklistHistoryTaskItem {
  return {
    id: 1,
    name: 'Task',
    description: null,
    responseType: 'YES_NO',
    completionType: 'SINGLE',
    scheduleType: 'EVERY_DAY',
    numericUnit: null,
    completed: false,
    currentlyActive: true,
    responses: [],
    ...overrides,
  };
}

function checklistDetail(tasks: ChecklistHistoryTaskItem[]): ChecklistHistoryDetail {
  return {
    storeId: 1,
    storeName: 'Downtown',
    date: '2026-09-23',
    hasChecklist: true,
    issues: [],
    categories: [{ id: 1, name: 'Opening Checks', tasks }],
  };
}

const completedResponse = {
  id: 10,
  employeeUserId: 7,
  employeeFullName: 'Ana Maria',
  empId: 'EMP-007',
  booleanValue: true,
  numericValue: null,
  textValue: null,
  respondedAt: '2026-09-23T08:00:00Z',
  latestCorrection: null,
  flaggedNeedsCorrection: false,
  flagReason: null,
  resubmissionHistory: [],
  undone: false,
};

function renderChecklist() {
  return render(
    <SuperAdminChecklist
      nav={{ storeId: 1, ts: 1 }}
    />,
  );
}

beforeEach(() => {
  mockGetAllStores.mockResolvedValue([
    { storeId: 1, storeName: 'Downtown', storeActive: true } as never,
  ]);
  mockGetStoreTrend.mockResolvedValue([]);
  mockGetDetail.mockResolvedValue(
    checklistDetail([
      taskItem({ id: 1, name: 'Check float cash in till' }),
      taskItem({ id: 2, name: 'Clean restrooms', completed: true, responses: [completedResponse] }),
    ]),
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('SuperAdminChecklist task sections', () => {
  it('renders Outstanding and Completed & Flagged sections with their task cards', async () => {
    renderChecklist();

    expect(await screen.findByText('Outstanding Tasks')).toBeInTheDocument();
    expect(screen.getByText('Completed & Flagged Tasks')).toBeInTheDocument();
    expect(screen.getByText('Check float cash in till')).toBeInTheDocument();
    expect(screen.getByText('Clean restrooms')).toBeInTheDocument();
    expect(screen.getByLabelText('1 completed tasks')).toHaveClass('store-detail-outstanding__count--completed');
    expect(screen.queryByLabelText('1 flagged tasks')).not.toBeInTheDocument();
  });

  it('shows a red issue count only when flagged tasks exist', async () => {
    mockGetDetail.mockResolvedValue(
      checklistDetail([
        taskItem({ id: 1, name: 'Clean restrooms', responses: [{ ...completedResponse, booleanValue: false }] }),
      ]),
    );

    renderChecklist();

    expect(await screen.findByLabelText('1 flagged tasks')).toHaveClass('store-detail-outstanding__count--issues');
    expect(screen.queryByLabelText(/completed tasks/i)).not.toBeInTheDocument();
  });

  it('keeps the user-controlled collapse state during live refresh', async () => {
    vi.useFakeTimers();
    renderChecklist();

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });
    const outstandingToggle = screen.getByRole('button', { name: /Outstanding Tasks/i });
    expect(outstandingToggle).toHaveAttribute('aria-expanded', 'true');

    fireEvent.click(outstandingToggle);
    expect(outstandingToggle).toHaveAttribute('aria-expanded', 'false');

    mockGetDetail.mockResolvedValueOnce(
      checklistDetail([
        taskItem({ id: 1, name: 'Check float cash in till' }),
        taskItem({ id: 2, name: 'Clean restrooms', completed: true, responses: [completedResponse] }),
      ]),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(mockGetDetail).toHaveBeenCalledTimes(3);
    expect(outstandingToggle).toHaveAttribute('aria-expanded', 'false');
  });
});

// Regression coverage for the reported bug: "Last Week" was collapsing to a
// single day (today minus 7) instead of the complete previous Mon-Sun week.
// Mirrors StoreDetail.test.tsx's identical coverage for the Admin page.
describe('SuperAdminChecklist "Last Week" filter', () => {
  it('fetches all 7 days of the complete previous Mon-Sun week, not a single day', async () => {
    renderChecklist();
    await screen.findByText('Outstanding Tasks');
    mockGetDetail.mockClear();

    await userEvent.click(screen.getByText('Last Week'));

    const expectedDates = datesInRange(previousCalendarWeekRange(todayDate()));
    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(7));
    const requestedDates = mockGetDetail.mock.calls.map(([, d]) => d);
    expect(new Set(requestedDates)).toEqual(new Set(expectedDates));
    expect(new Set(requestedDates).size).toBe(7);
  });

  it('sums stats across the complete week instead of showing one day', async () => {
    // Every day resolves to the same 2-task/1-completed detail (the mock
    // can't vary per date) -- 7 identical days must sum to 14/7, not 2/1.
    renderChecklist();
    await screen.findByText('Outstanding Tasks');

    await userEvent.click(screen.getByText('Last Week'));

    await waitFor(() => {
      const totalTasksCard = screen.getByText('Total Tasks').closest('.stat-card');
      expect(within(totalTasksCard as HTMLElement).getByText('14')).toBeInTheDocument();
    });
    const completedCard = screen.getByText('Completed').closest('.stat-card');
    expect(within(completedCard as HTMLElement).getByText('7')).toBeInTheDocument();
  });

  it('keeps the "Last Week" pill selected while active', async () => {
    renderChecklist();
    await screen.findByText('Outstanding Tasks');

    const lastWeekPill = screen.getByText('Last Week');
    await userEvent.click(lastWeekPill);
    await waitFor(() => {
      const totalTasksCard = screen.getByText('Total Tasks').closest('.stat-card');
      expect(within(totalTasksCard as HTMLElement).getByText('14')).toBeInTheDocument();
    });

    expect(lastWeekPill).toHaveClass('store-detail-page__date-pill--active');
  });

  it('returns to a single day (today) when "Today" is clicked afterward', async () => {
    renderChecklist();
    await screen.findByText('Outstanding Tasks');

    await userEvent.click(screen.getByText('Last Week'));
    await waitFor(() => {
      const totalTasksCard = screen.getByText('Total Tasks').closest('.stat-card');
      expect(within(totalTasksCard as HTMLElement).getByText('14')).toBeInTheDocument();
    });
    mockGetDetail.mockClear();

    await userEvent.click(screen.getByText('Today'));

    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledWith(1, todayDate()));
    await waitFor(() => {
      const totalTasksCard = screen.getByText('Total Tasks').closest('.stat-card');
      expect(within(totalTasksCard as HTMLElement).getByText('2')).toBeInTheDocument();
    });
  });

  it('still fetches only a single day for Yesterday', async () => {
    renderChecklist();
    await screen.findByText('Outstanding Tasks');
    mockGetDetail.mockClear();

    await userEvent.click(screen.getByText('Yesterday'));

    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(1));
    expect(mockGetDetail).toHaveBeenCalledWith(1, expect.any(String));
  });

  it('keeps the Export button visible and defaults its range to the selected week', async () => {
    renderChecklist();
    await screen.findByText('Outstanding Tasks');

    await userEvent.click(screen.getByText('Last Week'));
    await waitFor(() => {
      const totalTasksCard = screen.getByText('Total Tasks').closest('.stat-card');
      expect(within(totalTasksCard as HTMLElement).getByText('14')).toBeInTheDocument();
    });

    const exportButton = screen.getByRole('button', { name: /Export/i });
    expect(exportButton).toBeInTheDocument();
    await userEvent.click(exportButton);

    const range = previousCalendarWeekRange(todayDate());
    expect(screen.queryByText('Export this day (Excel)')).not.toBeInTheDocument();
    expect(screen.getByText(new Date(`${range.start}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))).toBeInTheDocument();
    expect(screen.getByText(new Date(`${range.end}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))).toBeInTheDocument();
  });
});
