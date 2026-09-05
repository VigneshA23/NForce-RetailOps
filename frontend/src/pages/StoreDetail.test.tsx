import { render, screen, waitFor } from '@testing-library/react';
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
    },
  ];
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
