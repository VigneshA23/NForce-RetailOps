import type { AdminTask, TaskStoreOption } from '../types/adminTask';
import { completionTypeLabel, responseTypeLabel, scheduleSummary } from '../utils/adminTaskOptions';
import TaskRowActions from './TaskRowActions';
import './TaskTable.css';

interface TaskTableProps {
  tasks: AdminTask[];
  isLoading?: boolean;
  onEdit: (task: AdminTask) => void;
  onDelete: (task: AdminTask) => void;
}

const MAX_VISIBLE_STORE_CHIPS = 2;

function storeChipLabel(store: TaskStoreOption): string {
  return store.name || 'Unknown Store';
}

function TaskStoreCell({ task }: { task: AdminTask }) {
  if (task.appliesToAllStores) {
    return (
      <span className="task-table__store-chip" title="All Stores">
        All Stores
      </span>
    );
  }

  if (task.stores.length === 0) {
    return <span className="task-table__store-chip" title="No stores selected">No stores</span>;
  }

  const visible = task.stores.slice(0, MAX_VISIBLE_STORE_CHIPS);
  const overflow = task.stores.slice(MAX_VISIBLE_STORE_CHIPS);

  return (
    <span className="task-table__store-chips">
      {visible.map((store) => (
        <span key={store.id} className="task-table__store-chip" title={storeChipLabel(store)}>
          {storeChipLabel(store)}
        </span>
      ))}
      {overflow.length > 0 && (
        <span
          className="task-table__store-chip task-table__store-chip--overflow"
          tabIndex={0}
          title={overflow.map(storeChipLabel).join(', ')}
          aria-label={`Also assigned to ${overflow.map(storeChipLabel).join(', ')}`}
        >
          +{overflow.length}
        </span>
      )}
    </span>
  );
}

function TaskTable({ tasks, isLoading = false, onEdit, onDelete }: TaskTableProps) {
  return (
    <div className="task-table__card">
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
                <td data-label="Response">{responseTypeLabel(task.responseType)}</td>
                <td data-label="Completion">{completionTypeLabel(task.completionType)}</td>
                <td data-label="Status">
                  <span className={`badge task-table__status-badge ${task.active ? 'badge--solid' : 'badge--outline'}`}>
                    {task.active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="task-table__actions-cell" data-label="Actions">
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
