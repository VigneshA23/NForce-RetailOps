import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import History from './History';
import * as checklistHistoryApi from '../api/checklistHistory';
import { todayDate } from '../utils/checklistHistoryOptions';
import type { ChecklistHistoryDetail, ChecklistHistorySummaryRow } from '../types/checklistHistory';

vi.mock('../api/checklistHistory', () => ({
  getChecklistHistorySummary: vi.fn(),
  getChecklistHistoryDetail: vi.fn(),
  ChecklistHistoryRangeError: class ChecklistHistoryRangeError extends Error {},
}));

const mockGetSummary = vi.mocked(checklistHistoryApi.getChecklistHistorySummary);
const mockGetDetail = vi.mocked(checklistHistoryApi.getChecklistHistoryDetail);

function summaryRow(): ChecklistHistorySummaryRow {
  return {
    storeId: 1,
    storeName: 'Downtown',
    date: todayDate(),
    hasChecklist: true,
    totalTasks: 2,
    completedTasks: 1,
    exceptionCount: 0,
  };
}

function detailFixture(): ChecklistHistoryDetail {
  return {
    storeId: 1,
    storeName: 'Downtown',
    date: todayDate(),
    hasChecklist: true,
    categories: [
      {
        id: 1,
        name: 'Opening',
        tasks: [
          {
            id: 1,
            name: 'Unlock front door',
            description: null,
            responseType: 'YES_NO',
            completionType: 'SINGLE',
            scheduleType: 'EVERY_DAY',
            numericUnit: null,
            completed: true,
            currentlyActive: true,
            responses: [
              {
                id: 1,
                employeeUserId: 6,
                employeeFullName: 'Jane Doe',
                empId: 'EMP-004',
                booleanValue: true,
                numericValue: null,
                textValue: null,
                respondedAt: `${todayDate()}T08:01:00Z`,
              },
            ],
          },
          {
            id: 2,
            name: 'Count register',
            description: null,
            responseType: 'YES_NO',
            completionType: 'SINGLE',
            scheduleType: 'EVERY_DAY',
            numericUnit: null,
            completed: false,
            currentlyActive: true,
            responses: [],
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  mockGetSummary.mockReset();
  mockGetDetail.mockReset();
  mockGetSummary.mockResolvedValue([summaryRow()]);
  mockGetDetail.mockResolvedValue(detailFixture());
});

describe('History page', () => {
  it('fetches the summary once on mount with the default (today, all stores) filters', async () => {
    render(<History />);

    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(1));
    const call = mockGetSummary.mock.calls[0][0];
    expect(call.storeIds).toEqual([]);
    expect(call.startDate).toBe(todayDate());
    expect(call.endDate).toBe(todayDate());
  });

  it('does not refetch when filters change without clicking Search', async () => {
    render(<History />);
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(1));

    const dateInput = screen.getByLabelText('Date');
    fireEvent.change(dateInput, { target: { value: '2026-08-01' } });

    expect(mockGetSummary).toHaveBeenCalledTimes(1);
  });

  it('refetches with updated filters when Search is clicked', async () => {
    render(<History />);
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(1));

    const dateInput = screen.getByLabelText('Date');
    fireEvent.change(dateInput, { target: { value: '2026-08-01' } });

    await userEvent.click(screen.getByRole('button', { name: /search/i }));

    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(2));
    expect(mockGetSummary.mock.calls[1][0].startDate).toBe('2026-08-01');
    expect(mockGetSummary.mock.calls[1][0].endDate).toBe('2026-08-01');
  });

  it('opens the detail modal and renders completed/not-completed items with employee EMP ID on View', async () => {
    render(<History />);
    await waitFor(() => expect(mockGetSummary).toHaveBeenCalledTimes(1));

    await userEvent.click(await screen.findByRole('button', { name: /view downtown checklist/i }));

    await waitFor(() => expect(mockGetDetail).toHaveBeenCalledWith(1, todayDate()));

    expect(await screen.findByText('Unlock front door')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toHaveClass('badge--success');
    expect(screen.getByText('Not Completed')).toHaveClass('badge--outline');
    expect(screen.getByText(/Jane Doe \(EMP-004\)/)).toBeInTheDocument();
  });
});
