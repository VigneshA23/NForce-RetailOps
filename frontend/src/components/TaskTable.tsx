import { Pencil, Trash2 } from 'lucide-react';
import type { AdminTask } from '../types/adminTask';
import { completionTypeLabel, responseTypeBadgeClass, responseTypeLabel, scheduleSummary } from '../utils/adminTaskOptions';
import StoreChips from './StoreChips';
import './TaskTable.css';

interface TaskTableProps {
  tasks: AdminTask[];
  isLoading?: boolean;
  onEdit: (task: AdminTask) => void;
  onDelete: (task: AdminTask) => void;
  onToggleStatus: (task: AdminTask) => void;
}

function TaskStoreCell({ task }: { task: AdminTask }) {
  if (task.appliesToAllStores) {
    return (
      <span className="store-chip" title="All Stores">
        All Stores
      </span>
    );
  }

  return <StoreChips stores={task.stores} emptyLabel="No stores" emptyTitle="No stores selected" />;
}

function TaskTable({ tasks, isLoading = false, onEdit, onDelete, onToggleStatus }: TaskTableProps) {
  return (
    <div className="table-card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Task</th>
              <th scope="col">Category</th>
              <th scope="col">Store</th>
              <th scope="col">Schedule</th>
              <th scope="col">Response</th>
              <th scope="col">Completion</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((task) => (
              <tr key={task.id}>
                <td className="task-table__name" data-label="Task">{task.name}</td>
                <td data-label="Category">{task.categoryName}</td>
                <td data-label="Store">
                  <TaskStoreCell task={task} />
                </td>
                <td data-label="Schedule">{scheduleSummary(task.scheduleType, task.selectedDays)}</td>
                <td data-label="Response">
                  <span className={`badge ${responseTypeBadgeClass(task.responseType)}`}>
                    {responseTypeLabel(task.responseType)}
                  </span>
                </td>
                <td data-label="Completion">{completionTypeLabel(task.completionType)}</td>
                <td data-label="Status">
                  <label
                    className="status-toggle"
                    title={task.active ? 'Deactivate task' : 'Activate task'}
                  >
                    <input
                      type="checkbox"
                      checked={task.active}
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
                    <button
                      type="button"
                      className="table-icon-btn"
                      aria-label={`Edit ${task.name}`}
                      title="Edit"
                      onClick={() => onEdit(task)}
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      className="table-icon-btn table-icon-btn--danger"
                      aria-label={`Delete ${task.name}`}
                      title="Delete"
                      onClick={() => onDelete(task)}
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
