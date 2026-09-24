import type { MouseEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { AdminTask } from '../types/adminTask';
import { completionTypeLabel, responseTypeBadgeClass, responseTypeLabel, scheduleSummary } from '../utils/adminTaskOptions';
import './TaskTable.css';

interface TaskTableProps {
  tasks: AdminTask[];
  isLoading?: boolean;
  // Shown only on the Super Admin Tasks page, which lists tasks across every
  // store -- the Owner Admin page omits it since its tasks are already
  // scoped to that owner's own store(s).
  showStoreColumn?: boolean;
  onRowClick: (task: AdminTask) => void;
  // Omitted by the Super Admin Tasks page, which doesn't support in-place
  // editing of a task's store/category scope for v1 -- the Edit action is
  // simply hidden rather than wired to a no-op.
  onEdit?: (task: AdminTask) => void;
  onDelete: (task: AdminTask) => void;
  onToggleStatus: (task: AdminTask) => void;
}

function stopRowClick(event: MouseEvent) {
  event.stopPropagation();
}

function isExpired(endDate?: string | null): boolean {
  if (!endDate) return false;
  return endDate < new Date().toISOString().slice(0, 10);
}

function taskStoresLabel(task: AdminTask): string {
  if (task.appliesToAllStores) return 'All Stores';
  if (task.stores.length === 0) return '—';
  return task.stores.map((store) => store.name).join(', ');
}

function TaskTable({ tasks, isLoading = false, showStoreColumn = false, onRowClick, onEdit, onDelete, onToggleStatus }: TaskTableProps) {
  return (
    <div className="table-card task-table-card">
      <div className="table-scroll task-table__desktop">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Category</th>
              {showStoreColumn && <th scope="col">Store</th>}
              <th scope="col">Schedule</th>
              <th scope="col">Response</th>
              <th scope="col">Completion</th>
              <th scope="col">Status</th>
              <th scope="col" className="task-table__actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => {
              const expired = isExpired(task.endDate);
              const blockActivation = !task.active && expired;
              return (
              <tr key={task.id} className="task-table__row" onClick={() => onRowClick(task)}>
                <td className="task-table__name" data-label="Task">{task.name}</td>
                <td data-label="Category">{task.categoryName}</td>
                {showStoreColumn && <td data-label="Store">{taskStoresLabel(task)}</td>}
                <td data-label="Schedule">{scheduleSummary(task.scheduleType, task.selectedDays, task.startDate, task.endDate)}</td>
                <td data-label="Response">
                  <span className={`badge ${responseTypeBadgeClass(task.responseType)}`}>
                    {responseTypeLabel(task.responseType)}
                  </span>
                </td>
                <td data-label="Completion">{completionTypeLabel(task.completionType)}</td>
                <td data-label="Status">
                  <label
                    className="status-toggle"
                    title={
                      blockActivation
                        ? 'This task\'s end date has passed and cannot be activated'
                        : task.active
                          ? 'Deactivate task'
                          : 'Activate task'
                    }
                    onClick={stopRowClick}
                  >
                    <input
                      type="checkbox"
                      checked={task.active}
                      disabled={blockActivation}
                      onChange={() => onToggleStatus(task)}
                      aria-label={task.active ? 'Deactivate task' : 'Activate task'}
                    />
                    <span className="status-toggle__track" aria-hidden="true">
                      <span className="status-toggle__thumb" />
                    </span>
                  </label>
                </td>
                <td className="table-actions-cell" data-label="Actions">
                  <div className="table-row-actions">
                    {onEdit && (
                      <button
                        type="button"
                        className="table-icon-btn"
                        aria-label={`Edit ${task.name}`}
                        title="Edit"
                        onClick={(event) => {
                          stopRowClick(event);
                          onEdit(task);
                        }}
                      >
                        <Pencil size={16} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn--danger"
                      aria-label={`Delete ${task.name}`}
                      title="Delete"
                      onClick={(event) => {
                        stopRowClick(event);
                        onDelete(task);
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile-only: the table above is hidden below --mobile in favor of this card list. */}
      <div className="task-table__mobile-cards">
        {tasks.map((task) => {
          const expired = isExpired(task.endDate);
          const blockActivation = !task.active && expired;
          return (
            <div
              className="task-mobile-card"
              key={task.id}
              onClick={() => onRowClick(task)}
            >
              <div className="task-mobile-card__top">
                <div className="task-mobile-card__identity">
                  <span className="task-mobile-card__name">{task.name}</span>
                </div>
                <label
                  className="status-toggle task-mobile-card__status"
                  title={
                    blockActivation
                      ? 'This task\'s end date has passed and cannot be activated'
                      : task.active
                        ? 'Deactivate task'
                        : 'Activate task'
                  }
                  onClick={stopRowClick}
                >
                  <input
                    type="checkbox"
                    checked={task.active}
                    disabled={blockActivation}
                    onChange={() => onToggleStatus(task)}
                    aria-label={task.active ? 'Deactivate task' : 'Activate task'}
                  />
                  <span className="status-toggle__track" aria-hidden="true">
                    <span className="status-toggle__thumb" />
                  </span>
                </label>
              </div>

              <div className="task-mobile-card__row">
                <span className="task-mobile-card__label">Category</span>
                <span className="task-mobile-card__value">{task.categoryName}</span>
              </div>

              {showStoreColumn && (
                <div className="task-mobile-card__row">
                  <span className="task-mobile-card__label">Store</span>
                  <span className="task-mobile-card__value">{taskStoresLabel(task)}</span>
                </div>
              )}

              <div className="task-mobile-card__row">
                <span className="task-mobile-card__label">Schedule</span>
                <span className="task-mobile-card__value">
                  {scheduleSummary(task.scheduleType, task.selectedDays, task.startDate, task.endDate)}
                </span>
              </div>

              <div className="task-mobile-card__row">
                <span className="task-mobile-card__label">Response</span>
                <span className={`badge ${responseTypeBadgeClass(task.responseType)}`}>
                  {responseTypeLabel(task.responseType)}
                </span>
              </div>

              <div className="task-mobile-card__row">
                <span className="task-mobile-card__label">Completion</span>
                <span className="task-mobile-card__value">{completionTypeLabel(task.completionType)}</span>
              </div>

              <div className="task-mobile-card__footer">
                <span className="task-mobile-card__label">Actions</span>
                <div className="task-mobile-card__actions">
                  {onEdit && (
                    <button
                      type="button"
                      className="task-mobile-card__icon-btn"
                      aria-label={`Edit ${task.name}`}
                      title="Edit"
                      onClick={(event) => {
                        stopRowClick(event);
                        onEdit(task);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="task-mobile-card__icon-btn task-mobile-card__icon-btn--danger"
                    aria-label={`Delete ${task.name}`}
                    title="Delete"
                    onClick={(event) => {
                      stopRowClick(event);
                      onDelete(task);
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!isLoading && tasks.length === 0 && (
        <div className="table-card__empty">No tasks match your filters.</div>
      )}
      {isLoading && <div className="table-card__empty">Loading tasks...</div>}
    </div>
  );
}

export default TaskTable;
