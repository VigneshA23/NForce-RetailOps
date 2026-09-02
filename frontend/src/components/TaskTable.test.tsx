import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  return render(<TaskTable tasks={tasks} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={vi.fn()} />);
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

describe('TaskTable status toggle', () => {
  it('shows an ON toggle for an active task and calls onToggleStatus when clicked', async () => {
    const onToggleStatus = vi.fn();
    const task = baseTask({ active: true });
    render(<TaskTable tasks={[task]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={onToggleStatus} />);

    const toggle = screen.getByLabelText('Deactivate task');
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);
    expect(onToggleStatus).toHaveBeenCalledWith(task);
  });

  it('shows an OFF toggle for an inactive task and calls onToggleStatus when clicked', async () => {
    const onToggleStatus = vi.fn();
    const task = baseTask({ active: false });
    render(<TaskTable tasks={[task]} onEdit={vi.fn()} onDelete={vi.fn()} onToggleStatus={onToggleStatus} />);

    const toggle = screen.getByLabelText('Activate task');
    expect(toggle).not.toBeChecked();

    await userEvent.click(toggle);
    expect(onToggleStatus).toHaveBeenCalledWith(task);
  });
});

describe('TaskTable actions', () => {
  it('renders direct Edit and Delete icon buttons instead of a menu', async () => {
    const onEdit = vi.fn();
    const onDelete = vi.fn();
    const task = baseTask({});
    render(<TaskTable tasks={[task]} onEdit={onEdit} onDelete={onDelete} onToggleStatus={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /task actions/i })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /edit wipe counters/i }));
    expect(onEdit).toHaveBeenCalledWith(task);

    await userEvent.click(screen.getByRole('button', { name: /delete wipe counters/i }));
    expect(onDelete).toHaveBeenCalledWith(task);
  });
});

describe('TaskTable response type badges', () => {
  it('applies the correct badge tone class for each response type', () => {
    renderTable([
      baseTask({ id: 1, name: 'Done task', responseType: 'DONE_NOT_DONE' }),
      baseTask({ id: 2, name: 'Number task', responseType: 'NUMERIC' }),
      baseTask({ id: 3, name: 'Yes/No task', responseType: 'YES_NO' }),
      baseTask({ id: 4, name: 'Text task', responseType: 'TEXT' }),
    ]);

    expect(screen.getByText('Done / Checkbox')).toHaveClass('badge--success');
    expect(screen.getByText('Number')).toHaveClass('badge--info');
    expect(screen.getByText('Yes / No')).toHaveClass('badge--warning');
    expect(screen.getByText('Short Text')).toHaveClass('badge--purple');
  });
});
