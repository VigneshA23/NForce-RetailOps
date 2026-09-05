import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import StoreDetailTable, { type StoreDetailRow } from './StoreDetailTable';
import type { ChecklistHistoryResponseEntry, ChecklistHistoryTaskItem } from '../types/checklistHistory';

function responseEntry(overrides: Partial<ChecklistHistoryResponseEntry>): ChecklistHistoryResponseEntry {
  return {
    id: 1,
    employeeUserId: 1,
    employeeFullName: 'Alice Caller',
    empId: 'EMP-001',
    booleanValue: true,
    numericValue: null,
    textValue: null,
    respondedAt: '2026-09-03T14:00:00Z',
    latestCorrection: null,
    ...overrides,
  };
}

function task(overrides: Partial<ChecklistHistoryTaskItem>): ChecklistHistoryTaskItem {
  return {
    id: 1,
    name: 'Wipe counters',
    description: null,
    responseType: 'YES_NO',
    completionType: 'MULTIPLE',
    scheduleType: 'EVERY_DAY',
    numericUnit: null,
    completed: true,
    currentlyActive: true,
    responses: [],
    ...overrides,
  };
}

function row(task: ChecklistHistoryTaskItem): StoreDetailRow {
  return { key: String(task.id), categoryName: 'Cleaning', task };
}

describe('StoreDetailTable employee column', () => {
  it('lists every employee who responded to a MULTIPLE-completion task, not just the last', () => {
    const multiTask = task({
      completionType: 'MULTIPLE',
      responses: [
        responseEntry({ id: 1, employeeUserId: 1, employeeFullName: 'Alice Caller', respondedAt: '2026-09-03T14:00:00Z' }),
        responseEntry({ id: 2, employeeUserId: 2, employeeFullName: 'Bob Teammate', respondedAt: '2026-09-03T15:00:00Z' }),
      ],
    });

    render(<StoreDetailTable rows={[row(multiTask)]} hasChecklist />);

    expect(screen.getByText('Alice Caller')).toBeInTheDocument();
    expect(screen.getByText('Bob Teammate')).toBeInTheDocument();
  });

  it('keeps the single-employee view for a SINGLE-completion task', () => {
    const singleTask = task({
      completionType: 'SINGLE',
      responses: [responseEntry({ id: 1, employeeUserId: 1, employeeFullName: 'Alice Caller' })],
    });

    render(<StoreDetailTable rows={[row(singleTask)]} hasChecklist />);

    expect(screen.getByText('Alice Caller')).toBeInTheDocument();
    expect(screen.getAllByText(/Alice Caller/)).toHaveLength(1);
  });

  it('shows an em dash when no one has responded yet', () => {
    const unansweredTask = task({ completed: false, responses: [] });

    render(<StoreDetailTable rows={[row(unansweredTask)]} hasChecklist />);

    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });
});
