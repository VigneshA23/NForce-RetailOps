import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import TaskDetailsModal from './TaskDetailsModal';
import type { AdminTask } from '../types/adminTask';

function baseTask(overrides: Partial<AdminTask>): AdminTask {
  return {
    id: 1,
    name: 'Prepare Waffle Cones',
    description: 'Prepare and stock waffle cones for the day.',
    categoryId: 1,
    categoryName: 'Preparation',
    displayOrder: 2,
    appliesToAllStores: false,
    stores: [
      { id: 1, name: 'Downtown - Store 1' },
      { id: 2, name: 'River way - Store 2' },
    ],
    responseType: 'DONE_NOT_DONE',
    responseNote: null,
    numericUnit: null,
    numericMin: null,
    numericMax: null,
    textMaxLength: null,
    completionType: 'SINGLE',
    maxCompletions: null,
    scheduleType: 'EVERY_DAY',
    selectedDays: [],
    startDate: '2026-02-01',
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

describe('TaskDetailsModal', () => {
  it('renders the full read-only configuration for the selected task', () => {
    render(<TaskDetailsModal task={baseTask({})} isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Task Details')).toBeInTheDocument();
    expect(screen.getByText('Prepare Waffle Cones')).toBeInTheDocument();
    expect(screen.getByText('Prepare and stock waffle cones for the day.')).toBeInTheDocument();
    expect(screen.getByText('Preparation')).toBeInTheDocument();
    expect(screen.getByText('Downtown - Store 1')).toBeInTheDocument();
    expect(screen.getByText('River way - Store 2')).toBeInTheDocument();
    expect(screen.getByText('Done / Checkbox')).toBeInTheDocument();
    expect(screen.getByText('Single Completion')).toBeInTheDocument();
    expect(screen.getByText('Every day')).toBeInTheDocument();
    expect(screen.getByText('01 Feb 2026')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows "All Stores" instead of a count when the task applies to all stores', () => {
    render(<TaskDetailsModal task={baseTask({ appliesToAllStores: true, stores: [] })} isOpen onClose={vi.fn()} />);

    expect(screen.getByText('All Stores')).toBeInTheDocument();
    expect(screen.queryByText(/^\d+ stores?$/i)).not.toBeInTheDocument();
  });

  it('falls back to a safe label for a store with no name', () => {
    render(
      <TaskDetailsModal
        task={baseTask({ stores: [{ id: 1, name: '' }] })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Unknown Store')).toBeInTheDocument();
  });

  it('shows the status as a read-only badge with no toggle control', () => {
    render(<TaskDetailsModal task={baseTask({ active: false })} isOpen onClose={vi.fn()} />);

    expect(screen.getByText('Inactive')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('shows Response Configuration for a Number task', () => {
    render(
      <TaskDetailsModal
        task={baseTask({ responseType: 'NUMERIC', numericUnit: '°F', numericMin: 32, numericMax: 40 })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Unit: °F')).toBeInTheDocument();
    expect(screen.getByText('Minimum Value: 32')).toBeInTheDocument();
    expect(screen.getByText('Maximum Value: 40')).toBeInTheDocument();
  });

  it('shows Response Configuration for a Short Text task', () => {
    render(
      <TaskDetailsModal
        task={baseTask({ responseType: 'TEXT', textMaxLength: 25 })}
        isOpen
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Maximum Character Limit: 25')).toBeInTheDocument();
  });

  it('hides Response Configuration for a Yes/No task', () => {
    render(<TaskDetailsModal task={baseTask({ responseType: 'YES_NO' })} isOpen onClose={vi.fn()} />);

    expect(screen.queryByText('Response Configuration')).not.toBeInTheDocument();
  });

  it('calls onClose when Close is clicked', async () => {
    const onClose = vi.fn();
    render(<TaskDetailsModal task={baseTask({})} isOpen onClose={onClose} />);

    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders nothing when there is no selected task', () => {
    render(<TaskDetailsModal task={null} isOpen onClose={vi.fn()} />);
    expect(screen.queryByText('Task Details')).not.toBeInTheDocument();
  });
});
