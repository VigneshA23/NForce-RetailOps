import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ChecklistHistoryTable from './ChecklistHistoryTable';
import type { ChecklistHistorySummaryRow } from '../types/checklistHistory';

function row(overrides: Partial<ChecklistHistorySummaryRow>): ChecklistHistorySummaryRow {
  return {
    storeId: 1,
    storeName: 'Downtown',
    date: '2026-08-25',
    hasChecklist: true,
    totalTasks: 10,
    completedTasks: 8,
    issueCount: 0,
    ...overrides,
  };
}

describe('ChecklistHistoryTable', () => {
  it('shows the completion count and a View button for a day with records', () => {
    render(<ChecklistHistoryTable rows={[row({})]} onView={vi.fn()} />);

    expect(screen.getByText('8/10 completed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /view downtown checklist/i })).toBeInTheDocument();
  });

  it('shows "No checklist records found" and no View button for an empty day', () => {
    render(
      <ChecklistHistoryTable
        rows={[row({ hasChecklist: false, totalTasks: 0, completedTasks: 0 })]}
        onView={vi.fn()}
      />,
    );

    expect(screen.getByText('No checklist records found for this date')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /view/i })).not.toBeInTheDocument();
  });

  it('calls onView with the row when View is clicked', async () => {
    const onView = vi.fn();
    const targetRow = row({});
    render(<ChecklistHistoryTable rows={[targetRow]} onView={onView} />);

    await userEvent.click(screen.getByRole('button', { name: /view downtown checklist/i }));
    expect(onView).toHaveBeenCalledWith(targetRow);
  });

  it('shows a page-level empty state when there are no rows at all', () => {
    render(<ChecklistHistoryTable rows={[]} onView={vi.fn()} />);

    expect(screen.getByText('No results for the selected stores and date range.')).toBeInTheDocument();
  });

  it('shows a loading state instead of the empty state while loading', () => {
    render(<ChecklistHistoryTable rows={[]} isLoading onView={vi.fn()} />);

    expect(screen.getByText('Loading checklist history...')).toBeInTheDocument();
    expect(screen.queryByText('No results for the selected stores and date range.')).not.toBeInTheDocument();
  });
});
