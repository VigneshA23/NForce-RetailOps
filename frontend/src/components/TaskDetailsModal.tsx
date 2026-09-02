import type { ReactNode } from 'react';
import type { AdminTask } from '../types/adminTask';
import {
  completionTypeLabel,
  dayLabel,
  formatTaskDate,
  responseTypeBadgeClass,
  responseTypeLabel,
  scheduleSummary,
} from '../utils/adminTaskOptions';
import Modal from './Modal';
import './TaskDetailsModal.css';

interface TaskDetailsModalProps {
  task: AdminTask | null;
  isOpen: boolean;
  onClose: () => void;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="task-details__row">
      <span className="task-details__label">{label}</span>
      <div className="task-details__value">{children}</div>
    </div>
  );
}

const DASH = '—';

function TaskDetailsModal({ task, isOpen, onClose }: TaskDetailsModalProps) {
  if (!task) return null;

  const startDate = formatTaskDate(task.startDate);
  const endDate = formatTaskDate(task.endDate);
  const showNumericConfig = task.responseType === 'NUMERIC';
  const showTextConfig = task.responseType === 'TEXT';
  const showResponseConfig = showNumericConfig || showTextConfig;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title="Task Details"
      footer={
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="task-details">
        <DetailRow label="Task Name">{task.name}</DetailRow>

        <DetailRow label="Description / Instructions">
          {task.description?.trim() ? task.description : DASH}
        </DetailRow>

        <DetailRow label="Category">{task.categoryName}</DetailRow>

        <DetailRow label="Applicable Stores">
          {task.appliesToAllStores ? (
            'All Stores'
          ) : task.stores.length > 0 ? (
            <ul className="task-details__store-list">
              {task.stores.map((store) => (
                <li key={store.id}>{store.name || 'Unknown Store'}</li>
              ))}
            </ul>
          ) : (
            DASH
          )}
        </DetailRow>

        <DetailRow label="Response Type">
          <span className={`badge ${responseTypeBadgeClass(task.responseType)}`}>
            {responseTypeLabel(task.responseType)}
          </span>
        </DetailRow>

        <DetailRow label="Completion Type">{completionTypeLabel(task.completionType)}</DetailRow>

        <DetailRow label="Schedule">{scheduleSummary(task.scheduleType, task.selectedDays)}</DetailRow>

        <DetailRow label="Selected Days">
          {task.scheduleType === 'SELECTED_DAYS' && task.selectedDays.length > 0
            ? task.selectedDays.map(dayLabel).join(', ')
            : DASH}
        </DetailRow>

        <DetailRow label="Start Date">{startDate ?? DASH}</DetailRow>

        <DetailRow label="End Date">{endDate ?? DASH}</DetailRow>

        <DetailRow label="Display Order">{task.displayOrder}</DetailRow>

        <DetailRow label="Status">
          <span
            className={`task-details__status ${
              task.active ? 'task-details__status--active' : 'task-details__status--inactive'
            }`}
          >
            <span className="task-details__status-dot" aria-hidden="true" />
            {task.active ? 'Active' : 'Inactive'}
          </span>
        </DetailRow>

        {showResponseConfig && (
          <div className="task-details__row">
            <span className="task-details__label">Response Configuration</span>
            <div className="task-details__value task-details__config">
              {showNumericConfig && (
                <>
                  <span>Unit: {task.numericUnit?.trim() ? task.numericUnit : DASH}</span>
                  <span>Minimum Value: {task.numericMin != null ? task.numericMin : DASH}</span>
                  <span>Maximum Value: {task.numericMax != null ? task.numericMax : DASH}</span>
                </>
              )}
              {showTextConfig && <span>Maximum Character Limit: {task.textMaxLength ?? DASH}</span>}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export default TaskDetailsModal;
