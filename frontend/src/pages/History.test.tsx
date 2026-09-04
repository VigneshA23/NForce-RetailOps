import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import History from './History';
import * as checklistHistoryApi from '../api/checklistHistory';
import * as csvUtil from '../utils/csv';
import { todayDate } from '../utils/checklistHistoryOptions';
import type {
  ChecklistHistoryOperationsReport,
  ChecklistHistorySummaryRow,
  ChecklistHistoryTaskDetailRow,
} from '../types/checklistHistory';

vi.mock('../api/checklistHistory', () => ({
  getChecklistHistoryOperationsReport: vi.fn(),
  ChecklistHistoryRangeError: class ChecklistHistoryRangeError extends Error {},
}));

vi.mock('../utils/csv', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/csv')>();
  return { ...actual, downloadCsv: vi.fn() };
});

const mockGetOperationsReport = vi.mocked(checklistHistoryApi.getChecklistHistoryOperationsReport);
const mockDownloadCsv = vi.mocked(csvUtil.downloadCsv);

function summaryRow(overrides: Partial<ChecklistHistorySummaryRow> = {}): ChecklistHistorySummaryRow {
  return {
    storeId: 1,
    storeName: 'Downtown',
    date: todayDate(),
    hasChecklist: true,
    totalTasks: 2,
    completedTasks: 1,
    issueCount: 0,
    ...overrides,
  };
}

function taskDetailRow(overrides: Partial<ChecklistHistoryTaskDetailRow> = {}): ChecklistHistoryTaskDetailRow {
  return {
    storeId: 2,
    storeName: 'Riverside',
    date: todayDate(),
    categoryName: 'Opening',
    taskName: 'Check freezer temp',
    status: 'COMPLETED',
    response: 'Yes',
    employeeFullName: 'Jane Doe',
    completedAt: `${todayDate()}T08:01:00Z`,
    ...overrides,
  };
}

function operationsReport(overrides: Partial<ChecklistHistoryOperationsReport> = {}): ChecklistHistoryOperationsReport {
  return {
    summary: [summaryRow({ storeId: 2, storeName: 'Riverside', totalTasks: 20, completedTasks: 18, issueCount: 2 })],
    details: [taskDetailRow()],
    ...overrides,
  };
}

beforeEach(() => {
  mockGetOperationsReport.mockReset();
  mockDownloadCsv.mockReset();
  mockGetOperationsReport.mockResolvedValue(operationsReport());
});

function summaryTable(): HTMLElement {
  return screen.getByTestId('operations-summary-table');
}

function taskDetailsTable(): HTMLElement {
  return screen.getByTestId('operations-task-details-table');
}

describe('Daily Operations Summary report', () => {
  it('requests the report once on mount for today, with no store parameter at all', async () => {
    render(<History />);

    await waitFor(() => expect(mockGetOperationsReport).toHaveBeenCalledTimes(1));
    expect(mockGetOperationsReport.mock.calls[0][0]).toEqual({ startDate: todayDate(), endDate: todayDate() });
  });

  it('renders one summary row per store with Scheduled/Completed/Completion %/Issues', async () => {
    render(<History />);

    await waitFor(() => expect(mockGetOperationsReport).toHaveBeenCalled());
    const row = within(summaryTable()).getByRole('row', { name: /Riverside/ });
    expect(row).toHaveTextContent('20');
    expect(row).toHaveTextContent('18');
    expect(row).toHaveTextContent('90%');
    expect(row).toHaveTextContent('2');
    expect(within(summaryTable()).getByText('Issues')).toBeInTheDocument();
    expect(screen.queryByText('Exceptions')).not.toBeInTheDocument();
  });

  it('shows 0% for a store with zero scheduled tasks, without an error', async () => {
    mockGetOperationsReport.mockResolvedValue(
      operationsReport({
        summary: [summaryRow({ storeId: 2, storeName: 'Riverside', totalTasks: 0, completedTasks: 0, issueCount: 0 })],
        details: [],
      }),
    );

    render(<History />);

    const row = await within(await screen.findByTestId('operations-summary-table')).findByRole('row', { name: /Riverside/ });
    expect(row).toHaveTextContent('0%');
  });

  it('shows the empty-state message when no operations data exists for the range', async () => {
    mockGetOperationsReport.mockResolvedValue(operationsReport({ summary: [], details: [] }));

    render(<History />);

    expect(await screen.findByText('No operations data found for the selected date range.')).toBeInTheDocument();
  });

  it('shows an API error state with a working Retry', async () => {
    mockGetOperationsReport.mockReset();
    mockGetOperationsReport.mockRejectedValueOnce(new Error('boom'));
    mockGetOperationsReport.mockResolvedValueOnce(operationsReport());

    render(<History />);

    expect(await screen.findByText('Failed to load the operations summary.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /retry/i }));

    await within(await screen.findByTestId('operations-summary-table')).findByRole('row', { name: /Riverside/ });
  });

  it('re-fetches with the selected date range when Generate Report is clicked', async () => {
    render(<History />);
    await waitFor(() => expect(mockGetOperationsReport).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2026-08-01' } });
    fireEvent.change(screen.getByLabelText('To Date'), { target: { value: '2026-08-05' } });

    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => expect(mockGetOperationsReport).toHaveBeenCalledTimes(2));
    expect(mockGetOperationsReport.mock.calls[1][0]).toEqual({ startDate: '2026-08-01', endDate: '2026-08-05' });
  });

  it('rejects an invalid range (start after end) without calling the API', async () => {
    render(<History />);
    await waitFor(() => expect(mockGetOperationsReport).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByLabelText('From Date'), { target: { value: todayDate() } });
    fireEvent.change(screen.getByLabelText('To Date'), { target: { value: '2000-01-01' } });
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));

    expect(screen.getByText('Start date must be on or before end date.')).toBeInTheDocument();
    expect(mockGetOperationsReport).toHaveBeenCalledTimes(1);
  });

  it('renders task-level details with Completed/Not Completed/Issue statuses', async () => {
    mockGetOperationsReport.mockResolvedValue(
      operationsReport({
        details: [
          taskDetailRow({ taskName: 'Restock shelves', status: 'COMPLETED' }),
          taskDetailRow({ taskName: 'Count register', status: 'NOT_COMPLETED', response: null, employeeFullName: null, completedAt: null }),
          taskDetailRow({ taskName: 'Check freezer temp', status: 'ISSUE', response: 'No' }),
        ],
      }),
    );

    render(<History />);

    expect(await screen.findByText('Task Details')).toBeInTheDocument();
    const detailsTable = taskDetailsTable();
    expect(within(detailsTable).getByText('Completed')).toHaveClass('badge--success');
    expect(within(detailsTable).getByText('Not Completed')).toHaveClass('badge--outline');
    expect(within(detailsTable).getByText('Issue')).toHaveClass('badge--danger');
  });

  it('exports a CSV containing the summary and task-level details on Export CSV', async () => {
    render(<History />);
    await waitFor(() => expect(mockGetOperationsReport).toHaveBeenCalled());
    await within(await screen.findByTestId('operations-summary-table')).findByRole('row', { name: /Riverside/ });

    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));

    expect(mockDownloadCsv).toHaveBeenCalledTimes(1);
    const [filename, content] = mockDownloadCsv.mock.calls[0];
    expect(filename).toContain('.csv');
    expect(content).toContain('SUMMARY');
    expect(content).toContain('DETAILS');
    expect(content).toContain('Riverside');
    expect(content).toContain('Issues');
  });

  it('prints only the report section on Print', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    render(<History />);
    await within(await screen.findByTestId('operations-summary-table')).findByRole('row', { name: /Riverside/ });

    await userEvent.click(screen.getByRole('button', { name: /print/i }));

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('places Generate Report, Export CSV and Print directly below the Task Details table, in that order', async () => {
    render(<History />);
    const detailsTable = await screen.findByTestId('operations-task-details-table');

    const generateButton = screen.getByRole('button', { name: /generate report/i });
    const exportButton = screen.getByRole('button', { name: /export csv/i });
    const printButton = screen.getByRole('button', { name: /print/i });

    // DOCUMENT_POSITION_FOLLOWING (4) means the button comes after the table in the DOM.
    expect(detailsTable.compareDocumentPosition(generateButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(detailsTable.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(detailsTable.compareDocumentPosition(printButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    const actionsRow = generateButton.closest('.history-page__report-footer-actions');
    expect(actionsRow).toContainElement(exportButton);
    expect(actionsRow).toContainElement(printButton);
    expect(actionsRow?.children[0]).toBe(generateButton);
    expect(actionsRow?.children[1]).toBe(exportButton);
    expect(actionsRow?.children[2]).toBe(printButton);
  });

  // Regression test for repeated searches with different date ranges: narrowing
  // 01-09..04-09 down to 03-09..04-09 must fully REPLACE the Task Details rows,
  // never leave the earlier (wider-range) rows mixed in alongside the new ones.
  it('fully replaces Task Details rows (no stale rows left behind) when the date range is narrowed and Generate Report is clicked again', async () => {
    mockGetOperationsReport.mockReset();
    mockGetOperationsReport.mockResolvedValueOnce(
      operationsReport({ details: [taskDetailRow({ date: '2026-09-01', taskName: 'Old task from Sept 1' })] }),
    );
    mockGetOperationsReport.mockResolvedValueOnce(
      operationsReport({ details: [taskDetailRow({ date: '2026-09-04', taskName: 'New task from Sept 4' })] }),
    );

    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Old task from Sept 1');

    fireEvent.change(screen.getByLabelText('From Date'), { target: { value: '2026-09-03' } });
    fireEvent.change(screen.getByLabelText('To Date'), { target: { value: '2026-09-04' } });
    await userEvent.click(screen.getByRole('button', { name: /generate report/i }));

    await waitFor(() => expect(mockGetOperationsReport).toHaveBeenCalledTimes(2));
    const table = within(await screen.findByTestId('operations-task-details-table'));
    expect(await table.findByText('New task from Sept 4')).toBeInTheDocument();
    expect(table.queryByText('Old task from Sept 1')).not.toBeInTheDocument();
  });

});

describe('Task Details filters', () => {
  function detailsRows(): ChecklistHistoryTaskDetailRow[] {
    return [
      taskDetailRow({
        categoryName: 'Cleaning',
        taskName: 'Sweep & Mop Floor',
        status: 'COMPLETED',
        response: 'OK',
        employeeFullName: 'Test Employee',
      }),
      taskDetailRow({
        categoryName: 'Cleaning',
        taskName: 'Empty Trash',
        status: 'NOT_COMPLETED',
        response: null,
        employeeFullName: null,
      }),
      taskDetailRow({
        categoryName: 'Opening',
        taskName: 'Unlock Front Door',
        status: 'ISSUE',
        response: 'No',
        employeeFullName: 'Jane Doe',
      }),
    ];
  }

  beforeEach(() => {
    mockGetOperationsReport.mockResolvedValue(operationsReport({ details: detailsRows() }));
  });

  it('populates filter options from the actual fetched Task Details rows, not hard-coded values', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    const categorySelect = screen.getByLabelText('Category') as HTMLSelectElement;
    const optionLabels = Array.from(categorySelect.options).map((option) => option.textContent);
    expect(optionLabels).toEqual(['All Categories', 'Cleaning', 'Opening']);
  });

  it('filters by Category', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Cleaning');

    const table = within(taskDetailsTable());
    expect(table.getByText('Sweep & Mop Floor')).toBeInTheDocument();
    expect(table.getByText('Empty Trash')).toBeInTheDocument();
    expect(table.queryByText('Unlock Front Door')).not.toBeInTheDocument();
  });

  it('narrows the Task dropdown to the selected Category (dependent filtering)', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Cleaning');

    const taskSelect = screen.getByLabelText('Task') as HTMLSelectElement;
    const optionLabels = Array.from(taskSelect.options).map((option) => option.textContent);
    expect(optionLabels).toEqual(['All Tasks', 'Empty Trash', 'Sweep & Mop Floor']);
  });

  it('filters by Task', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('Task'), 'Sweep & Mop Floor');

    const table = within(taskDetailsTable());
    expect(table.getByText('Sweep & Mop Floor')).toBeInTheDocument();
    expect(table.queryByText('Empty Trash')).not.toBeInTheDocument();
    expect(table.queryByText('Unlock Front Door')).not.toBeInTheDocument();
  });

  it('filters by Status', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'ISSUE');

    const table = within(taskDetailsTable());
    expect(table.getByText('Unlock Front Door')).toBeInTheDocument();
    expect(table.queryByText('Sweep & Mop Floor')).not.toBeInTheDocument();
    expect(table.queryByText('Empty Trash')).not.toBeInTheDocument();
  });

  it('filters by Response', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('Response'), 'OK');

    const table = within(taskDetailsTable());
    expect(table.getByText('Sweep & Mop Floor')).toBeInTheDocument();
    expect(table.queryByText('Unlock Front Door')).not.toBeInTheDocument();
  });

  it('filters by User', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('User'), 'Test Employee');

    const table = within(taskDetailsTable());
    expect(table.getByText('Sweep & Mop Floor')).toBeInTheDocument();
    expect(table.queryByText('Unlock Front Door')).not.toBeInTheDocument();
    expect(table.queryByText('Empty Trash')).not.toBeInTheDocument();
  });

  it('applies multiple filters together (AND, not OR)', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Cleaning');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'COMPLETED');
    await userEvent.selectOptions(screen.getByLabelText('Response'), 'OK');
    await userEvent.selectOptions(screen.getByLabelText('User'), 'Test Employee');

    const table = within(taskDetailsTable());
    expect(table.getByText('Sweep & Mop Floor')).toBeInTheDocument();
    expect(table.queryByText('Empty Trash')).not.toBeInTheDocument();
    expect(table.queryByText('Unlock Front Door')).not.toBeInTheDocument();
  });

  it('shows an empty-state message when filters exclude every row, without stale rows remaining', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Opening');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'COMPLETED');

    expect(screen.getByText('No task details match the selected filters.')).toBeInTheDocument();
    const table = within(taskDetailsTable());
    expect(table.queryByText('Sweep & Mop Floor')).not.toBeInTheDocument();
    expect(table.queryByText('Unlock Front Door')).not.toBeInTheDocument();
  });

  it('resetting a filter back to "All" restores the complete date-range dataset', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Cleaning');
    expect(within(taskDetailsTable()).queryByText('Unlock Front Door')).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'ALL');

    const table = within(taskDetailsTable());
    expect(table.getByText('Sweep & Mop Floor')).toBeInTheDocument();
    expect(table.getByText('Empty Trash')).toBeInTheDocument();
    expect(table.getByText('Unlock Front Door')).toBeInTheDocument();
  });

  it('exports only the currently filtered rows to CSV', async () => {
    render(<History />);
    await within(await screen.findByTestId('operations-task-details-table')).findByText('Sweep & Mop Floor');

    await userEvent.selectOptions(screen.getByLabelText('Category'), 'Cleaning');
    await userEvent.click(screen.getByRole('button', { name: /export csv/i }));

    const [, content] = mockDownloadCsv.mock.calls[0];
    expect(content).toContain('Sweep & Mop Floor');
    expect(content).toContain('Empty Trash');
    expect(content).not.toContain('Unlock Front Door');
  });
});
