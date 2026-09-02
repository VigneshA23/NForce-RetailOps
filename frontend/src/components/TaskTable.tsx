import type { MouseEvent } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import type { AdminTask } from '../types/adminTask';
import { completionTypeLabel, responseTypeBadgeClass, responseTypeLabel, scheduleSummary } from '../utils/adminTaskOptions';
import './TaskTable.css';

interface TaskTableProps {
  tasks: AdminTask[];
  isLoading?: boolean;
  onRowClick: (task: AdminTask) => void;
  onEdit: (task: AdminTask) => void;
  onDelete: (task: AdminTask) => void;
  onToggleStatus: (task: AdminTask) => void;
}

function stopRowClick(event: MouseEvent) {
  event.stopPropagation();
}

function TaskTable({ tasks, isLoading = false, onRowClick, onEdit, onDelete, onToggleStatus }: TaskTableProps) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Category</th>
              <th scope="col">Schedule</th>
              <th scope="col">Response</th>
              <th scope="col">Completion</th>
              <th scope="col">Status</th>
              <th scope="col" className="task-table__actions-header">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id} className="task-table__row" onClick={() => onRowClick(task)}>
                <td className="task-table__name" data-label="Task">{task.name}</td>
                <td data-label="Category">{task.categoryName}</td>
                <td data-label="Schedule">{scheduleSummary(task.scheduleType, task.selectedDays)}</td>
                <td data-label="Response">
                  <span className={`badge ${responseTypeBadgeClass(task.responseType)}`}>
                    {responseTypeLabel(task.responseType)}
                  </span>
                </td>
                <td data-label="Completion">{completionTypeLabel(task.completionType)}</td>
                <td data-label="Status">
                  <label
                    className="task-status-toggle"
                    title={task.active ? 'Deactivate task' : 'Activate task'}
                    onClick={stopRowClick}
                  >
                    <input
                      type="checkbox"
                      checked={task.active}
                      onChange={() => onToggleStatus(task)}
                      aria-label={task.active ? 'Deactivate task' : 'Activate task'}
                    />
                    <span className="task-status-toggle__track" aria-hidden="true">
                      <span className="task-status-toggle__thumb" />
                    </span>
                  </label>
                </td>
                <td className="task-table__actions-cell" data-label="Actions">
                  <div className="task-table__actions">
                    <button
                      type="button"
                      className="task-table__icon-btn"
                      aria-label={`Edit ${task.name}`}
                      title="Edit"
                      onClick={(event) => {
                        stopRowClick(event);
                        onEdit(task);
                      }}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="task-table__icon-btn task-table__icon-btn--danger"
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
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && tasks.length === 0 && (
        <div className="table-card__empty">No tasks match your filters.</div>
      )}
      {isLoading && <div className="table-card__empty">Loading tasks...</div>}
    </div>
  );
}

export default TaskTable;
