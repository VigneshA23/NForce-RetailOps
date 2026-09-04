import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StoreDetail from './StoreDetail';
import * as checklistHistoryApi from '../api/checklistHistory';
import { todayDate } from '../utils/checklistHistoryOptions';
import type { ChecklistHistoryDetail, ChecklistHistorySummaryRow, ChecklistHistoryTaskItem } from '../types/checklistHistory';

vi.mock('../api/checklistHistory', () => ({
  getChecklistHistoryDetail: vi.fn(),
  getChecklistHistorySummary: vi.fn(),
  ChecklistHistoryRangeError: class ChecklistHistoryRangeError extends Error {},
}));

const mockGetDetail = vi.mocked(checklistHistoryApi.getChecklistHistoryDetail);
const mockGetSummary = vi.mocked(checklistHistoryApi.getChecklistHistorySummary);

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

function detail(storeId: number, storeName: string, categories: ChecklistHistoryDetail['categories']): ChecklistHistoryDetail {
  return { storeId, storeName, date: todayDate(), hasChecklist: true, categories };
}

function respondedYes(id: number) {
  return [
    {
      id,
      employeeUserId: 1,
      employeeFullName: 'Jane Doe',
      empId: 'EMP-001',
      booleanValue: true,
      numericValue: null,
      textValue: null,
      respondedAt: `${todayDate()}T08:00:00Z`,
    },
  ];
}

beforeEach(() => {
  mockGetDetail.mockReset();
  mockGetSummary.mockReset();
  mockGetSummary.mockResolvedValue([]);
});

describe('StoreDetail progress indicator', () => {
  it('shows the overall completion percentage for the selected store/date', async () => {
    mockGetDetail.mockResolvedValue(
      detail(1, 'Downtown', [
        {
          id: 1,
          name: 'Preparation',
          tasks: [
            taskItem({ id: 1, completed: true, responses: respondedYes(1) }),
            taskItem({ id: 2, completed: false }),
          ],
        },
      ]),
    );

    render(<StoreDetail storeId={1} />);

    expect(await screen.findByText('50%')).toBeInTheDocument();
    expect(screen.getByText('Completion')).toBeInTheDocument();
  });

  it('shows each category\'s completed/total sub-fraction', async () => {
    mockGetDetail.mockResolvedValue(
      detail(1, 'Downtown', [
        {
          id: 1,
          name: 'Preparation',
          tasks: [taskItem({ id: 1, completed: true, responses: respondedYes(1) }), taskItem({ id: 2 })],
        },
        {
          id: 2,
          name: 'Cleaning',
          tasks: [taskItem({ id: 3, completed: true, responses: respondedYes(2) })],
        },
      ]),
    );

    render(<StoreDetail storeId={1} />);

    expect(await screen.findByText('Preparation 1/2')).toBeInTheDocument();
    expect(screen.getByText('Cleaning 1/1')).toBeInTheDocument();
  });

  it('shows 0% with no scheduled tasks, without dividing by zero', async () => {
    mockGetDetail.mockResolvedValue(detail(1, 'Downtown', []));

    render(<StoreDetail storeId={1} />);

    await waitFor(() => expect(mockGetDetail).toHaveBeenCalled());
    expect(await screen.findByText('0%')).toBeInTheDocument();
  });

  it('shows 100% when every scheduled task is completed', async () => {
    mockGetDetail.mockResolvedValue(
      detail(1, 'Downtown', [
        {
          id: 1,
          name: 'Preparation',
          tasks: [
            taskItem({ id: 1, completed: true, responses: respondedYes(1) }),
            taskItem({ id: 2, completed: true, responses: respondedYes(2) }),
          ],
        },
      ]),
    );

    render(<StoreDetail storeId={1} />);

    expect(await screen.findByText('100%')).toBeInTheDocument();
    expect(screen.getByText('Preparation 2/2')).toHaveClass('badge--success');
  });
});

function summaryRow(overrides: Partial<ChecklistHistorySummaryRow>): ChecklistHistorySummaryRow {
  return {
    storeId: 1,
    storeName: 'Downtown',
    date: todayDate(),
    hasChecklist: true,
    totalTasks: 0,
    completedTasks: 0,
    exceptionCount: 0,
    ...overrides,
  };
}

describe('Daily Operations Summary report', () => {
  beforeEach(() => {
    mockGetDetail.mockResolvedValue(detail(1, 'Downtown', []));
  });

  it('sums Scheduled/Completed/Exceptions across the date range into one row per store', async () => {
    mockGetSummary.mockResolvedValue([
      summaryRow({ storeId: 1, storeName: 'Downtown', date: '2026-08-01', totalTasks: 10, completedTasks: 9, exceptionCount: 1 }),
      summaryRow({ storeId: 1, storeName: 'Downtown', date: '2026-08-02', totalTasks: 10, completedTasks: 9, exceptionCount: 1 }),
    ]);

    render(<StoreDetail storeId={1} />);

    const downtownRow = await screen.findByRole('row', { name: /Downtown/ });
    expect(downtownRow).toHaveTextContent('20'); // scheduled (10 + 10)
    expect(downtownRow).toHaveTextContent('18'); // completed (9 + 9)
    expect(downtownRow).toHaveTextContent('90%');
    expect(downtownRow).toHaveTextContent('2'); // exceptions (1 + 1)
  });

  it('shows 0% for a store with zero scheduled tasks in range, without an error', async () => {
    mockGetSummary.mockResolvedValue([summaryRow({ totalTasks: 0, completedTasks: 0 })]);

    render(<StoreDetail storeId={1} />);

    const row = await screen.findByRole('row', { name: /Downtown/ });
    expect(row).toHaveTextContent('0%');
  });

  it('scopes the report summary to the assigned store', async () => {
    mockGetSummary.mockResolvedValue([]);
    render(<StoreDetail storeId={1} />);

    await waitFor(() => expect(mockGetSummary).toHaveBeenCalled());
    expect(mockGetSummary.mock.calls[0][0].storeIds).toEqual([1]);
  });

  it('prints only the report section, not the rest of the page', async () => {
    mockGetSummary.mockResolvedValue([summaryRow({})]);
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    render(<StoreDetail storeId={1} />);
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalled());

    await userEvent.setup().click(await screen.findByRole('button', { name: /print/i }));

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });
});
