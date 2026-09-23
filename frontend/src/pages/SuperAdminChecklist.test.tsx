import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import SuperAdminChecklist from './SuperAdminChecklist';
import * as checklistHistoryApi from '../api/checklistHistory';
import * as superAdminStoresApi from '../api/superAdminStores';
import * as superAdminOperationsApi from '../api/superAdminOperations';
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
