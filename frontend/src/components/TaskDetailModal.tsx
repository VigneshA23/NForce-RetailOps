import type { AdminTask } from '../types/adminTask';
import { completionTypeLabel, responseTypeLabel, scheduleSummary } from '../utils/adminTaskOptions';
import Modal from './Modal';
import './TaskDetailModal.css';

interface TaskDetailModalProps {
  task: AdminTask | null;
  onClose: () => void;
  onEdit: (task: AdminTask) => void;
}

function TaskDetailModal({ task, onClose, onEdit }: TaskDetailModalProps) {
  if (!task) return null;

  const storesLabel = task.appliesToAllStores
    ? 'All Stores'
    : task.stores.length > 0
      ? task.stores.map((store) => store.name).join(', ')
      : 'No stores selected';

  const timeLabel =
    task.timeMode === 'WINDOW' && task.startTime && task.endTime
      ? `${task.startTime} - ${task.endTime}`
      : 'Anytime during scheduled day';

  return (
    <Modal
      isOpen={task !== null}
      onClose={onClose}
      title={task.name}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Close
          </button>
          <button type="button" className="btn btn--primary" onClick={() => onEdit(task)}>
            Edit Task
          </button>
        </>
      }
    >
      <div className="task-detail">
        <span className={`badge ${task.active ? 'badge--solid' : 'badge--outline'}`}>
          {task.active ? 'Active' : 'Inactive'}
        </span>

        {task.description && <p className="task-detail__description">{task.description}</p>}

        <dl className="task-detail__grid">
          <div>
            <dt>Category</dt>
            <dd>{task.categoryName}</dd>
          </div>
          <div>
            <dt>Stores</dt>
            <dd>{storesLabel}</dd>
          </div>
          <div>
            <dt>Response Type</dt>
            <dd>{responseTypeLabel(task.responseType)}</dd>
          </div>
          <div>
            <dt>Completion Type</dt>
            <dd>
              {completionTypeLabel(task.completionType)}
              {task.completionType === 'MULTIPLE' && task.maxCompletions ? ` (max ${task.maxCompletions})` : ''}
            </dd>
          </div>
          <div>
            <dt>Schedule</dt>
            <dd>{scheduleSummary(task.scheduleType, task.selectedDays)}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{timeLabel}</dd>
          </div>
          <div>
            <dt>Start Date</dt>
            <dd>{task.startDate}</dd>
          </div>
          <div>
            <dt>End Date</dt>
            <dd>{task.endDate ?? 'Ongoing'}</dd>
          </div>
          {task.responseType === 'NUMERIC' && (
            <div>
              <dt>Expected Range</dt>
              <dd>
                {task.numericMin ?? '—'} to {task.numericMax ?? '—'} {task.numericUnit ?? ''}
              </dd>
            </div>
          )}
          {task.responseType === 'TEXT' && task.responseNote && (
            <div>
              <dt>Short Text</dt>
              <dd>{task.responseNote}</dd>
            </div>
          )}
          {(task.responseType === 'YES_NO' || task.responseType === 'DONE_NOT_DONE') && task.responseNote && (
            <div>
              <dt>Response Note</dt>
              <dd>{task.responseNote}</dd>
            </div>
          )}
        </dl>
      </div>
    </Modal>
  );
}

export default TaskDetailModal;
