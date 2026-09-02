import { useEffect, useState } from 'react';
import { ClipboardList } from 'lucide-react';
import Modal from './Modal';
import { getChecklistHistoryDetail } from '../api/checklistHistory';
import type { ChecklistHistoryDetail } from '../types/checklistHistory';
import { checklistItemStatusBadgeClass, formatDateLabel, formatTimeLabel } from '../utils/checklistHistoryOptions';
import './ChecklistHistoryDetailModal.css';

export interface ChecklistHistoryDetailTarget {
  storeId: number;
  storeName: string;
  date: string;
}

interface ChecklistHistoryDetailModalProps {
  target: ChecklistHistoryDetailTarget | null;
  onClose: () => void;
}

function ChecklistHistoryDetailModal({ target, onClose }: ChecklistHistoryDetailModalProps) {
  const [detail, setDetail] = useState<ChecklistHistoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    if (!target) return;
    setIsLoading(true);
    setError(null);
    getChecklistHistoryDetail(target.storeId, target.date)
      .then(setDetail)
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    if (!target) {
      setDetail(null);
      setError(null);
      setIsLoading(false);
      return;
    }
    load();
  }, [target?.storeId, target?.date]);

  return (
    <Modal
      isOpen={target !== null}
      onClose={onClose}
      title={target ? `${target.storeName} — ${formatDateLabel(target.date)}` : ''}
      size="lg"
      footer={
        <button type="button" className="btn btn--secondary" onClick={onClose}>
          Close
        </button>
      }
    >
      <div className="checklist-history-detail">
        {isLoading && <p className="checklist-history-detail__status">Loading checklist...</p>}

        {!isLoading && error && (
          <div className="checklist-history-detail__status checklist-history-detail__status--error">
            <p>{error}</p>
            <button type="button" className="btn btn--secondary" onClick={load}>
              Retry
            </button>
          </div>
        )}

        {!isLoading && !error && detail && detail.categories.length === 0 && (
          <div className="checklist-history-detail__empty">
            <ClipboardList size={32} />
            <h3>No checklist recorded</h3>
            <p>No checklist template was in effect for this store on this day.</p>
          </div>
        )}

        {!isLoading && !error && detail && detail.categories.length > 0 && (
          <div className="checklist-history-detail__categories">
            {detail.categories.map((category) => (
              <div key={category.id} className="checklist-history-detail__category">
                <h4>{category.name}</h4>
                {category.tasks.length === 0 ? (
                  <p className="checklist-history-detail__no-tasks">No tasks in this category for this day.</p>
                ) : (
                  <div className="checklist-history-detail__tasks">
                    {category.tasks.map((task) => (
                      <div key={task.id} className="checklist-history-detail__task">
                        <div className="checklist-history-detail__task-header">
                          <span className="checklist-history-detail__task-name">{task.name}</span>
                          <span className={`badge ${checklistItemStatusBadgeClass(task.completed)}`}>
                            {task.completed ? 'Completed' : 'Not Completed'}
                          </span>
                        </div>
                        {task.responses.map((response) => (
                          <p key={response.id} className="checklist-history-detail__response">
                            {formatTimeLabel(response.respondedAt)} — {response.employeeFullName}
                            {response.empId ? ` (${response.empId})` : ''}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

export default ChecklistHistoryDetailModal;
