import type { AdminTask } from '../types/adminTask';
import { completionTypeLabel, responseTypeLabel, scheduleSummary } from '../utils/adminTaskOptions';
import TaskRowActions from './TaskRowActions';
import './TaskTable.css';

interface TaskTableProps {
  tasks: AdminTask[];
  isLoading?: boolean;
  onEdit: (task: AdminTask) => void;
  onDelete: (task: AdminTask) => void;
}

function TaskTable({ tasks, isLoading = false, onEdit, onDelete }: TaskTableProps) {
  return (
    <div className="task-table__card">
      <div className="task-table__scroll">
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
                <td className="task-table__name">{task.name}</td>
                <td>{task.categoryName}</td>
                <td>{task.appliesToAllStores ? 'All Stores' : `${task.stores.length} store${task.stores.length === 1 ? '' : 's'}`}</td>
                <td>{scheduleSummary(task.scheduleType, task.selectedDays)}</td>
                <td>{responseTypeLabel(task.responseType)}</td>
                <td>{completionTypeLabel(task.completionType)}</td>
                <td>
                  <span className={`badge task-table__status-badge ${task.active ? 'badge--solid' : 'badge--outline'}`}>
                    {task.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="task-table__actions-cell">
                  <TaskRowActions onEdit={() => onEdit(task)} onDelete={() => onDelete(task)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!isLoading && tasks.length === 0 && (
        <div className="task-table__empty">No tasks match your filters.</div>
      )}
      {isLoading && <div className="task-table__empty">Loading tasks...</div>}
    </div>
  );
}

export default TaskTable;
