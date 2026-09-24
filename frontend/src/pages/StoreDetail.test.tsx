import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StoreDetail from './StoreDetail';
import * as checklistHistoryApi from '../api/checklistHistory';
import { todayDate, previousCalendarWeekRange, datesInRange } from '../utils/checklistHistoryOptions';
import type { ChecklistHistoryDetail, ChecklistHistoryTaskItem } from '../types/checklistHistory';

vi.mock('../api/checklistHistory', () => ({
  getChecklistHistoryDetail: vi.fn(),
}));

const mockGetDetail = vi.mocked(checklistHistoryApi.getChecklistHistoryDetail);

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
  return { storeId, storeName, date: todayDate(), hasChecklist: true, categories, issues: [] };
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
      latestCorrection: null,
      flaggedNeedsCorrection: false,
      flagReason: null,
      resubmissionHistory: [],
      undone: false,
    },
  ];
}

function respondedWith(id: number, employeeFullName: string, booleanValue: boolean) {
  return [
    {
      id,
      employeeUserId: id,
      employeeFullName,
      empId: `EMP-00${id}`,
      booleanValue,
      numericValue: null,
      textValue: null,
      respondedAt: `${todayDate()}T08:00:00Z`,
      latestCorrection: null,
      flaggedNeedsCorrection: false,
      flagReason: null,
      resubmissionHistory: [],
      undone: false,
    },
  ];
}

function searchSampleDetail(): ChecklistHistoryDetail {
  return detail(1, 'Downtown', [
    {
      id: 1,
      name: 'Opening Checks',
      tasks: [
        taskItem({ id: 1, name: 'Check float cash in till', responses: respondedWith(1, 'Jane Doe', true) }),
        taskItem({ id: 2, name: 'Clean restrooms', responses: respondedWith(2, 'John Smith', false) }),
      ],
    },
  ]);
}

beforeEach(() => {
  mockGetDetail.mockReset();
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

    await waitFor(() => {
      const cards = document.querySelectorAll('.cat-prog-card');
      expect(cards.length).toBe(2);
    });
    const [prepCard, cleanCard] = document.querySelectorAll('.cat-prog-card');
    expect(within(prepCard as HTMLElement).getByText('Preparation')).toBeInTheDocument();
    expect(within(prepCard as HTMLElement).getByText('1/2')).toBeInTheDocument();
    expect(within(cleanCard as HTMLElement).getByText('Cleaning')).toBeInTheDocument();
    expect(within(cleanCard as HTMLElement).getByText('1/1')).toBeInTheDocument();
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
    await waitFor(() => {
      const cards = document.querySelectorAll('.cat-prog-card');
      expect(cards.length).toBe(1);
    });
    const [doneCard] = document.querySelectorAll('.cat-prog-card');
    expect(doneCard).toHaveClass('cat-prog-card--done');
  });
});

describe('StoreDetail search', () => {
  it('matches rows by employee name', async () => {
    mockGetDetail.mockResolvedValue(searchSampleDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Check float cash in till');

    await userEvent.type(screen.getByPlaceholderText('Search tasks, employees, status…'), 'Jane');

    const tables = screen.getAllByRole('table');
    const table = within(tables[tables.length - 1]);
    expect(table.getByText('Check float cash in till')).toBeInTheDocument();
    expect(table.queryByText('Clean restrooms')).not.toBeInTheDocument();
  });

  it('matches rows by response value', async () => {
    mockGetDetail.mockResolvedValue(searchSampleDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Check float cash in till');

    await userEvent.type(screen.getByPlaceholderText('Search tasks, employees, status…'), 'No');

    const tables = screen.getAllByRole('table');
    const table = within(tables[tables.length - 1]);
    expect(table.getByText('Clean restrooms')).toBeInTheDocument();
    expect(table.queryByText('Check float cash in till')).not.toBeInTheDocument();
  });

  it('matches rows by status label', async () => {
    mockGetDetail.mockResolvedValue(searchSampleDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Check float cash in till');

    await userEvent.type(screen.getByPlaceholderText('Search tasks, employees, status…'), 'Issue');

    const tables = screen.getAllByRole('table');
    const table = within(tables[tables.length - 1]);
    expect(table.getByText('Clean restrooms')).toBeInTheDocument();
    expect(table.queryByText('Check float cash in till')).not.toBeInTheDocument();
  });
});

// Regression coverage for the reported bug: "Last Week" was collapsing to a
// single day (today minus 7) instead of the complete previous Mon-Sun week.
describe('StoreDetail "Last Week" filter', () => {
  function singleTaskDetail(): ChecklistHistoryDetail {
    return detail(1, 'Downtown', [
      {
        id: 1,
        name: 'Preparation',
        tasks: [taskItem({ id: 1, completed: true, responses: respondedYes(1) }), taskItem({ id: 2 })],
      },
    ]);
  }

  it('fetches all 7 days of the complete previous Mon-Sun week, not a single day', async () => {
    mockGetDetail.mockResolvedValue(singleTaskDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Completion');
    mockGetDetail.mockClear();

    await userEvent.click(screen.getByText('Last Week'));

    const expectedRange = previousCalendarWeekRange(todayDate());
    const expectedDates = datesInRange(expectedRange);
    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(7));
    const requestedDates = mockGetDetail.mock.calls.map(([, d]) => d);
    expect(new Set(requestedDates)).toEqual(new Set(expectedDates));
    // Must not collapse to the single "today minus 7 days" bug.
    expect(new Set(requestedDates).size).toBe(7);
  });

  it('sums stats across the complete week instead of showing one day', async () => {
    // Every day of the range resolves to the same 2-task/1-completed detail
    // (the mock can't vary per date) -- 7 identical days must still sum to
    // 14 total tasks / 7 completed, not the single day's 2 / 1.
    mockGetDetail.mockResolvedValue(singleTaskDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Completion');

    await userEvent.click(screen.getByText('Last Week'));

    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(1 + 7));
    expect(await screen.findByText('14')).toBeInTheDocument(); // Total Tasks
    const completedCard = screen.getByText('Completed').closest('.stat-card');
    expect(within(completedCard as HTMLElement).getByText('7')).toBeInTheDocument();
  });

  it('keeps the "Last Week" pill selected while active', async () => {
    mockGetDetail.mockResolvedValue(singleTaskDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Completion');

    const lastWeekPill = screen.getByText('Last Week');
    await userEvent.click(lastWeekPill);
    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(1 + 7));

    expect(lastWeekPill).toHaveClass('store-detail-page__date-pill--active');
  });

  it('returns to a single day (today) when "Today" is clicked afterward', async () => {
    mockGetDetail.mockResolvedValue(singleTaskDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Completion');

    await userEvent.click(screen.getByText('Last Week'));
    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(1 + 7));
    mockGetDetail.mockClear();

    await userEvent.click(screen.getByText('Today'));

    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(1));
    expect(mockGetDetail).toHaveBeenCalledWith(1, todayDate());
    // Back to single-day totals (2 tasks, not the week's 14).
    await waitFor(() => {
      const totalTasksCard = screen.getByText('Total Tasks').closest('.stat-card');
      expect(within(totalTasksCard as HTMLElement).getByText('2')).toBeInTheDocument();
    });
  });

  it('still fetches only a single day for Yesterday', async () => {
    mockGetDetail.mockResolvedValue(singleTaskDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Completion');
    mockGetDetail.mockClear();

    await userEvent.click(screen.getByText('Yesterday'));

    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(1));
  });

  it('keeps the Export button visible and defaults its range to the selected week', async () => {
    mockGetDetail.mockResolvedValue(singleTaskDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Completion');

    await userEvent.click(screen.getByText('Last Week'));
    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledTimes(1 + 7));

    const exportButton = screen.getByRole('button', { name: /Export/i });
    expect(exportButton).toBeInTheDocument();
    await userEvent.click(exportButton);

    const range = previousCalendarWeekRange(todayDate());
    // No single-day export option -- the range form is shown directly,
    // pre-filled with the selected week rather than a stray leftover date.
    expect(screen.queryByText('Export this day (Excel)')).not.toBeInTheDocument();
    expect(screen.getByText(new Date(`${range.start}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))).toBeInTheDocument();
    expect(screen.getByText(new Date(`${range.end}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }))).toBeInTheDocument();
  });
});
