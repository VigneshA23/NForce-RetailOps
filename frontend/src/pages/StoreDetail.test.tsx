import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import StoreDetail from './StoreDetail';
import * as checklistHistoryApi from '../api/checklistHistory';
import { todayDate } from '../utils/checklistHistoryOptions';
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
      latestCorrection: null,
      flaggedNeedsCorrection: false,
      flagReason: null,
      resubmissionHistory: [],
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

    await userEvent.type(screen.getByRole('searchbox'), 'Jane');

    const table = within(screen.getByRole('table'));
    expect(table.getByText('Check float cash in till')).toBeInTheDocument();
    expect(table.queryByText('Clean restrooms')).not.toBeInTheDocument();
  });

  it('matches rows by response value', async () => {
    mockGetDetail.mockResolvedValue(searchSampleDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Check float cash in till');

    await userEvent.type(screen.getByRole('searchbox'), 'No');

    const table = within(screen.getByRole('table'));
    expect(table.getByText('Clean restrooms')).toBeInTheDocument();
    expect(table.queryByText('Check float cash in till')).not.toBeInTheDocument();
  });

  it('matches rows by status label', async () => {
    mockGetDetail.mockResolvedValue(searchSampleDetail());
    render(<StoreDetail storeId={1} />);
    await screen.findByText('Check float cash in till');

    await userEvent.type(screen.getByRole('searchbox'), 'Issue');

    const table = within(screen.getByRole('table'));
    expect(table.getByText('Clean restrooms')).toBeInTheDocument();
    expect(table.queryByText('Check float cash in till')).not.toBeInTheDocument();
  });
});
