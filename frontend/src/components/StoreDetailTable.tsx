import type { ChecklistHistoryTaskItem } from '../types/checklistHistory';
import { responseDisplayValue, taskFrequencyLabel, taskStatus, formatTimeLabel, type ChecklistTaskStatus } from '../utils/checklistHistoryOptions';
import './StoreDetailTable.css';

export interface StoreDetailRow {
  key: string;
  categoryName: string;
  task: ChecklistHistoryTaskItem;
}

interface StoreDetailTableProps {
  rows: StoreDetailRow[];
  isLoading?: boolean;
  hasChecklist: boolean;
}

const STATUS_LABELS: Record<ChecklistTaskStatus, string> = {
  OPEN: 'Open',
  COMPLETE: 'Complete',
  ISSUE: 'Issue',
};

const STATUS_BADGE_CLASS: Record<ChecklistTaskStatus, string> = {
  OPEN: 'badge--outline',
  COMPLETE: 'badge--success',
  ISSUE: 'badge--danger',
};

function StoreDetailTable({ rows, isLoading = false, hasChecklist }: StoreDetailTableProps) {
  return (
    <div className="table-card store-detail-table__card">
      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Category</th>
              <th scope="col">Task</th>
              <th scope="col">Response</th>
              <th scope="col">Employee</th>
              <th scope="col" className="store-detail-table__status-cell">
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ key, categoryName, task }) => {
              const status = taskStatus(task);
              const response = task.responses.length > 0 ? task.responses[task.responses.length - 1] : null;
              return (
                <tr key={key}>
                  <td data-label="Category" className="store-detail-table__category">
                    {categoryName}
                  </td>
                  <td data-label="Task">
                    <span className="store-detail-table__task-name">{task.name}</span>
                    <span className="store-detail-table__task-meta">{taskFrequencyLabel(task)}</span>
                  </td>
                  <td
                    data-label="Response"
                    className={status === 'ISSUE' ? 'store-detail-table__response--issue' : undefined}
                  >
                    {responseDisplayValue(task)}
                  </td>
                  <td data-label="Employee">
                    {response ? (
                      <>
                        {response.employeeFullName}
                        <span className="store-detail-table__response-time"> · {formatTimeLabel(response.respondedAt)}</span>
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td data-label="Status" className="store-detail-table__status-cell">
                    <span className={`badge ${STATUS_BADGE_CLASS[status]}`}>{STATUS_LABELS[status]}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!isLoading && rows.length === 0 && (
        <div className="table-card__empty">
          {hasChecklist
            ? 'No tasks match the selected filter.'
            : 'No checklist template was in effect for this store on this day.'}
        </div>
      )}
      {isLoading && <div className="table-card__empty">Loading checklist...</div>}
    </div>
  );
}

export default StoreDetailTable;
