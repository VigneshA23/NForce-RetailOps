import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { ChecklistHistoryResponseEntry, ChecklistHistoryTaskItem } from '../types/checklistHistory';
import { responseDisplayValue, taskFrequencyLabel, taskStatus, formatTimeLabel, formatDateLabel, type ChecklistTaskStatus } from '../utils/checklistHistoryOptions';
import CorrectionModal from './CorrectionModal';
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
  onResponseCorrected?: (taskId: number, updatedResponse: ChecklistHistoryResponseEntry) => void;
  repeatOffenderMap?: Map<number, number>;
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

interface CorrectionTarget {
  responseEntry: ChecklistHistoryResponseEntry;
  task: ChecklistHistoryTaskItem;
}

function CorrectedBadge({ responseEntry, task }: { responseEntry: ChecklistHistoryResponseEntry; task: ChecklistHistoryTaskItem }) {
  const [open, setOpen] = useState(false);
  const c = responseEntry.latestCorrection!;
  const correctedAt = `${formatDateLabel(c.correctedAt.slice(0, 10))} ${formatTimeLabel(c.correctedAt)}`;

  const originalVal =
    c.originalValueBoolean !== null
      ? task.responseType === 'YES_NO'
        ? c.originalValueBoolean ? 'Yes' : 'No'
        : c.originalValueBoolean ? 'Done' : 'Not done'
      : c.originalValueNumeric !== null
        ? task.numericUnit ? `${c.originalValueNumeric} ${task.numericUnit}` : String(c.originalValueNumeric)
        : (c.originalValueText ?? '—');

  const correctedVal =
    c.correctedValueBoolean !== null
      ? task.responseType === 'YES_NO'
        ? c.correctedValueBoolean ? 'Yes' : 'No'
        : c.correctedValueBoolean ? 'Done' : 'Not done'
      : c.correctedValueNumeric !== null
        ? task.numericUnit ? `${c.correctedValueNumeric} ${task.numericUnit}` : String(c.correctedValueNumeric)
        : (c.correctedValueText ?? '—');

  return (
    <span className="store-detail-table__corrected-wrap">
      <button
        type="button"
        className="store-detail-table__corrected-badge"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Correction details"
      >
        Corrected
      </button>
      {open && (
        <span className="store-detail-table__correction-popover">
          <span className="store-detail-table__correction-popover-row">
            <span className="store-detail-table__correction-popover-label">By</span>
            {c.correctedByFullName}
          </span>
          <span className="store-detail-table__correction-popover-row">
            <span className="store-detail-table__correction-popover-label">When</span>
            {correctedAt}
          </span>
          <span className="store-detail-table__correction-popover-row">
            <span className="store-detail-table__correction-popover-label">Change</span>
            {originalVal} → {correctedVal}
          </span>
          {c.reason && (
            <span className="store-detail-table__correction-popover-row">
              <span className="store-detail-table__correction-popover-label">Reason</span>
              <em>{c.reason}</em>
            </span>
          )}
        </span>
      )}
    </span>
  );
}

function StoreDetailTable({ rows, isLoading = false, hasChecklist, onResponseCorrected, repeatOffenderMap }: StoreDetailTableProps) {
  const [correctionTarget, setCorrectionTarget] = useState<CorrectionTarget | null>(null);

  return (
    <>
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
                const responders = task.responses;
                return (
                  <tr key={key} id={`task-row-${key}`}>
                    <td data-label="Category" className="store-detail-table__category">
                      {categoryName}
                    </td>
                    <td data-label="Task">
                      <span className="store-detail-table__task-name">
                        {task.name}
                        {(repeatOffenderMap?.get(task.id) ?? 0) >= 3 && (
                          <span
                            className="store-detail-table__repeat-dot"
                            title={`This task has been open ${repeatOffenderMap!.get(task.id)} of the last 7 days`}
                            aria-label={`This task has been open ${repeatOffenderMap!.get(task.id)} of the last 7 days`}
                          />
                        )}
                      </span>
                      <span className="store-detail-table__task-meta">{taskFrequencyLabel(task)}</span>
                    </td>
                    <td
                      data-label="Response"
                      className={status === 'ISSUE' ? 'store-detail-table__response--issue' : undefined}
                    >
                      {responseDisplayValue(task)}
                    </td>
                    <td data-label="Employee">
                      {responders.length > 0 ? (
                        responders.map((responder) => (
                          <div key={responder.id} className="store-detail-table__employee-entry">
                            <span className="store-detail-table__employee-line">
                              {responder.employeeFullName}
                              <span className="store-detail-table__response-time"> · {formatTimeLabel(responder.respondedAt)}</span>
                            </span>
                            <span className="store-detail-table__employee-actions">
                              {responder.latestCorrection && (
                                <CorrectedBadge responseEntry={responder} task={task} />
                              )}
                              {onResponseCorrected && (
                                <button
                                  type="button"
                                  className="store-detail-table__correct-btn"
                                  onClick={() => setCorrectionTarget({ responseEntry: responder, task })}
                                  aria-label="Correct this response"
                                  title="Correct this response"
                                >
                                  <Pencil size={12} />
                                </button>
                              )}
                            </span>
                          </div>
                        ))
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
        {isLoading && <div className="table-card__empty">Loading checklist…</div>}
      </div>

      {correctionTarget && (
        <CorrectionModal
          isOpen={correctionTarget !== null}
          onClose={() => setCorrectionTarget(null)}
          responseEntry={correctionTarget.responseEntry}
          task={correctionTarget.task}
          onSaved={(updatedResponse) => {
            onResponseCorrected?.(correctionTarget.task.id, updatedResponse);
            setCorrectionTarget(null);
          }}
        />
      )}
    </>
  );
}

export default StoreDetailTable;
