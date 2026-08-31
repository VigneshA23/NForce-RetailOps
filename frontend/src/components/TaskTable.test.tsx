import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TaskTable from './TaskTable';
import type { AdminTask } from '../types/adminTask';

function baseTask(overrides: Partial<AdminTask>): AdminTask {
  return {
    id: 1,
    name: 'Wipe counters',
    description: null,
    categoryId: 1,
    categoryName: 'Cleaning',
    displayOrder: 0,
    appliesToAllStores: false,
    stores: [],
    responseType: 'YES_NO',
    responseNote: null,
    numericUnit: null,
    numericMin: null,
    numericMax: null,
    textMaxLength: null,
    completionType: 'SINGLE',
    maxCompletions: null,
    scheduleType: 'EVERY_DAY',
    selectedDays: [],
    startDate: '2026-01-01',
    endDate: null,
    timeMode: 'ANYTIME',
    startTime: null,
    endTime: null,
    active: true,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function renderTable(tasks: AdminTask[]) {
  return render(<TaskTable tasks={tasks} onEdit={vi.fn()} onDelete={vi.fn()} />);
}

describe('TaskTable Store column', () => {
  it('shows "All Stores" for a task configured with All Stores', () => {
    renderTable([baseTask({ appliesToAllStores: true, stores: [] })]);

    expect(screen.getByText('All Stores')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ stores?$/i)).not.toBeInTheDocument();
  });

  it('shows the actual store name for a single-store task', () => {
    renderTable([baseTask({ stores: [{ id: 1, name: 'River way - Store 2' }] })]);

    expect(screen.getByText('River way - Store 2')).toBeInTheDocument();
  });

  it('shows both actual store names for a two-store task', () => {
    renderTable([
      baseTask({
        stores: [
          { id: 1, name: 'Downtown - Store 1' },
          { id: 2, name: 'River way - Store 2' },
        ],
      }),
    ]);

    expect(screen.getByText('Downtown - Store 1')).toBeInTheDocument();
    expect(screen.getByText('River way - Store 2')).toBeInTheDocument();
  });

  it('shows a compact +N overflow chip for more than two stores', () => {
    renderTable([
      baseTask({
        stores: [
          { id: 1, name: 'Downtown - Store 1' },
          { id: 2, name: 'River way - Store 2' },
          { id: 3, name: 'Uptown - Store 3' },
        ],
      }),
    ]);

    expect(screen.getByText('Downtown - Store 1')).toBeInTheDocument();
    expect(screen.getByText('River way - Store 2')).toBeInTheDocument();
    expect(screen.queryByText('Uptown - Store 3')).not.toBeInTheDocument();
    const overflow = screen.getByText('+1');
    expect(overflow).toHaveAttribute('title', 'Uptown - Store 3');
  });

  it('falls back to a safe label instead of crashing when a store has no name', () => {
    renderTable([baseTask({ stores: [{ id: 1, name: '' }] })]);

    expect(screen.getByText('Unknown Store')).toBeInTheDocument();
  });
});
