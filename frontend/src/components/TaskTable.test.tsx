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

function renderTable(tasks: AdminTask[], overrides: Partial<Parameters<typeof TaskTable>[0]> = {}) {
  return render(
    <TaskTable
      tasks={tasks}
      onRowClick={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onToggleStatus={vi.fn()}
      {...overrides}
    />,
  );
}

describe('TaskTable row click', () => {
  it('opens Task Details when a normal cell (task name) is clicked', async () => {
    const onRowClick = vi.fn();
    const task = baseTask({});
    renderTable([task], { onRowClick });

    await userEvent.click(screen.getByText('Wipe counters'));
    expect(onRowClick).toHaveBeenCalledWith(task);
  });

  it('opens Task Details when clicking the category cell', async () => {
    const onRowClick = vi.fn();
    const task = baseTask({});
    renderTable([task], { onRowClick });

    await userEvent.click(screen.getByText('Cleaning'));
    expect(onRowClick).toHaveBeenCalledWith(task);
  });

  it('does NOT open Task Details when clicking the status toggle', async () => {
    const onRowClick = vi.fn();
    const onToggleStatus = vi.fn();
    const task = baseTask({ active: true });
    renderTable([task], { onRowClick, onToggleStatus });

    await userEvent.click(screen.getByLabelText('Deactivate task'));
    expect(onToggleStatus).toHaveBeenCalledWith(task);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('does NOT open Task Details when clicking Edit', async () => {
    const onRowClick = vi.fn();
    const onEdit = vi.fn();
    const task = baseTask({});
    renderTable([task], { onRowClick, onEdit });

    await userEvent.click(screen.getByRole('button', { name: /edit wipe counters/i }));
    expect(onEdit).toHaveBeenCalledWith(task);
    expect(onRowClick).not.toHaveBeenCalled();
  });

  it('does NOT open Task Details when clicking Delete', async () => {
    const onRowClick = vi.fn();
    const onDelete = vi.fn();
    const task = baseTask({});
    renderTable([task], { onRowClick, onDelete });

    await userEvent.click(screen.getByRole('button', { name: /delete wipe counters/i }));
    expect(onDelete).toHaveBeenCalledWith(task);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});

describe('TaskTable columns', () => {
  it('does not render a Store column in the main table', () => {
    renderTable([baseTask({ stores: [{ id: 1, name: 'Downtown - Store 1' }] })]);

    expect(screen.queryByRole('columnheader', { name: 'Store' })).not.toBeInTheDocument();
    expect(screen.queryByText('Downtown - Store 1')).not.toBeInTheDocument();
  });
});

describe('TaskTable status toggle', () => {
  it('shows an ON toggle for an active task and calls onToggleStatus when clicked', async () => {
    const onToggleStatus = vi.fn();
    const task = baseTask({ active: true });
    renderTable([task], { onToggleStatus });

    const toggle = screen.getByLabelText('Deactivate task');
    expect(toggle).toBeChecked();

    await userEvent.click(toggle);
    expect(onToggleStatus).toHaveBeenCalledWith(task);
  });

  it('shows an OFF toggle for an inactive task and calls onToggleStatus when clicked', async () => {
    const onToggleStatus = vi.fn();
    const task = baseTask({ active: false });
    renderTable([task], { onToggleStatus });

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
    renderTable([task], { onEdit, onDelete });

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
