import { useEffect, useState } from 'react';
import { ClipboardList, Pencil, History } from 'lucide-react';
import Modal from './Modal';
import {
  correctResponse,
  getCorrectionHistory,
  getChecklistHistoryDetail,
} from '../api/checklistHistory';
import type {
  AdminCorrectionEntry,
  ChecklistHistoryDetail,
  ChecklistHistoryResponseEntry,
  ChecklistHistoryTaskItem,
} from '../types/checklistHistory';
import { checklistItemStatusBadgeClass, formatDateLabel, formatTimeLabel } from '../utils/checklistHistoryOptions';
import './ChecklistHistoryDetailModal.css';

export interface ChecklistHistoryDetailTarget {
  storeId: number;
  storeName: string;
  date: string;
}

interface CorrectionTarget {
  response: ChecklistHistoryResponseEntry;
  task: ChecklistHistoryTaskItem;
}

interface ChecklistHistoryDetailModalProps {
  target: ChecklistHistoryDetailTarget | null;
  onClose: () => void;
}

function formatResponseValue(entry: ChecklistHistoryResponseEntry): string {
  if (entry.booleanValue !== null && entry.booleanValue !== undefined) {
    return entry.booleanValue ? 'Done' : 'Not done';
  }
  if (entry.numericValue !== null && entry.numericValue !== undefined) {
    return String(entry.numericValue);
  }
  if (entry.textValue !== null && entry.textValue !== undefined) {
    return entry.textValue;
  }
  return '';
}

function formatOriginalValue(correction: AdminCorrectionEntry): string {
  if (correction.originalValueBoolean !== null && correction.originalValueBoolean !== undefined) {
    return correction.originalValueBoolean ? 'Done' : 'Not done';
  }
  if (correction.originalValueNumeric !== null && correction.originalValueNumeric !== undefined) {
    return String(correction.originalValueNumeric);
  }
  if (correction.originalValueText !== null && correction.originalValueText !== undefined) {
    return correction.originalValueText;
  }
  return '—';
}

function formatCorrectedValue(correction: AdminCorrectionEntry): string {
  if (correction.correctedValueBoolean !== null && correction.correctedValueBoolean !== undefined) {
    return correction.correctedValueBoolean ? 'Done' : 'Not done';
  }
  if (correction.correctedValueNumeric !== null && correction.correctedValueNumeric !== undefined) {
    return String(correction.correctedValueNumeric);
  }
  if (correction.correctedValueText !== null && correction.correctedValueText !== undefined) {
    return correction.correctedValueText;
  }
  return '—';
}

function CorrectionForm({
  target,
  onSuccess,
  onCancel,
}: {
  target: CorrectionTarget;
  onSuccess: (updated: ChecklistHistoryResponseEntry) => void;
  onCancel: () => void;
}) {
  const { response, task } = target;
  const responseType = task.responseType;

  const [boolValue, setBoolValue] = useState<boolean | null>(response.booleanValue ?? null);
  const [numValue, setNumValue] = useState<string>(
    response.numericValue !== null && response.numericValue !== undefined ? String(response.numericValue) : '',
  );
  const [textValue, setTextValue] = useState<string>(response.textValue ?? '');
  const [reason, setReason] = useState('');
  const [confirmStep, setConfirmStep] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentDisplay = formatResponseValue(response);

  function newDisplay(): string {
    if (responseType === 'YES_NO' || responseType === 'DONE_NOT_DONE') {
      if (boolValue === null) return '—';
      return boolValue ? 'Done' : 'Not done';
    }
    if (responseType === 'NUMERIC') return numValue || '—';
    return textValue || '—';
  }

  function handleConfirmClick() {
    if (responseType === 'YES_NO' || responseType === 'DONE_NOT_DONE') {
      if (boolValue === null) {
        setError('Please select a value.');
        return;
      }
    }
    if (responseType === 'NUMERIC' && numValue === '') {
      setError('Please enter a number.');
      return;
    }
    if (responseType === 'TEXT' && textValue === '') {
      setError('Please enter a value.');
      return;
    }
    setError(null);
    setConfirmStep(true);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const body =
        responseType === 'YES_NO' || responseType === 'DONE_NOT_DONE'
          ? { correctedBooleanValue: boolValue, reason: reason || null }
          : responseType === 'NUMERIC'
            ? { correctedNumericValue: Number(numValue), reason: reason || null }
            : { correctedTextValue: textValue, reason: reason || null };

      const result = await correctResponse(response.id, body);
      onSuccess(result.updatedResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save correction');
      setConfirmStep(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (confirmStep) {
    return (
      <div className="checklist-history-detail__correction-form">
        <p style={{ margin: 0, fontSize: 13 }}>
          Change response from <strong>{currentDisplay}</strong> to <strong>{newDisplay()}</strong>?
          {reason && <span style={{ color: 'var(--color-text-muted)' }}> Reason: {reason}</span>}
        </p>
        {error && <p className="checklist-history-detail__correction-error">{error}</p>}
        <div className="checklist-history-detail__correction-actions">
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setConfirmStep(false)} disabled={submitting}>
            Back
          </button>
          <button type="button" className="btn btn--primary btn--sm" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : 'Confirm'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="checklist-history-detail__correction-form">
      {(responseType === 'YES_NO' || responseType === 'DONE_NOT_DONE') && (
        <label>
          New value
          <div className="checklist-history-detail__correction-toggle">
            <button type="button" className={boolValue === true ? 'active' : ''} onClick={() => setBoolValue(true)}>
              Done
            </button>
            <button type="button" className={boolValue === false ? 'active' : ''} onClick={() => setBoolValue(false)}>
              Not done
            </button>
          </div>
        </label>
      )}
      {responseType === 'NUMERIC' && (
        <label>
          New value
          <input
            type="number"
            value={numValue}
            onChange={(e) => setNumValue(e.target.value)}
            placeholder="Enter number"
          />
        </label>
      )}
      {responseType === 'TEXT' && (
        <label>
          New value
          <input
            type="text"
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            maxLength={task.numericUnit ? undefined : 25}
            placeholder="Enter text"
          />
        </label>
      )}
      <label>
        Reason (optional)
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="Brief note explaining the correction"
        />
      </label>
      {error && <p className="checklist-history-detail__correction-error">{error}</p>}
      <div className="checklist-history-detail__correction-actions">
        <button type="button" className="btn btn--secondary btn--sm" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={handleConfirmClick}>
          Review
        </button>
      </div>
    </div>
  );
}

function CorrectionHistoryPanel({ responseId, onClose }: { responseId: number; onClose: () => void }) {
  const [history, setHistory] = useState<AdminCorrectionEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCorrectionHistory(responseId)
      .then(setHistory)
      .catch((err: Error) => setError(err.message));
  }, [responseId]);

  return (
    <div className="checklist-history-detail__correction-form">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)' }}>Correction history</span>
        <button type="button" className="btn btn--secondary btn--sm" onClick={onClose}>Close</button>
      </div>
      {error && <p className="checklist-history-detail__correction-error">{error}</p>}
      {history === null && !error && <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>Loading…</p>}
      {history && history.length === 0 && (
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>No corrections recorded.</p>
      )}
      {history && history.length > 0 && (
        <div className="checklist-history-detail__correction-history">
          {history.map((entry) => (
            <div key={entry.id} className="checklist-history-detail__correction-history-item">
              <strong>{formatOriginalValue(entry)}</strong>
              {' → '}
              <strong>{formatCorrectedValue(entry)}</strong>
              {' by '}
              {entry.correctedByFullName}
              {' at '}
              {new Date(entry.correctedAt).toLocaleString()}
              {entry.reason && <span style={{ color: 'var(--color-text-muted)' }}> — {entry.reason}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistHistoryDetailModal({ target, onClose }: ChecklistHistoryDetailModalProps) {
  const [detail, setDetail] = useState<ChecklistHistoryDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Correction state — only one form open at a time across all responses.
  const [correctionTarget, setCorrectionTarget] = useState<CorrectionTarget | null>(null);
  const [historyTarget, setHistoryTarget] = useState<number | null>(null); // responseId

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
      setCorrectionTarget(null);
      setHistoryTarget(null);
      return;
    }
    load();
  }, [target?.storeId, target?.date]);

  function handleCorrectionSuccess(responseId: number, updated: ChecklistHistoryResponseEntry) {
    setCorrectionTarget(null);
    setHistoryTarget(null);
    // Update the in-memory detail so the displayed value and badge refresh immediately.
    setDetail((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        categories: prev.categories.map((cat) => ({
          ...cat,
          tasks: cat.tasks.map((task) => ({
            ...task,
            responses: task.responses.map((r) => (r.id === responseId ? updated : r)),
          })),
        })),
      };
    });
  }

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
                        {task.responses.map((response) => {
                          const isEditOpen =
                            correctionTarget?.response.id === response.id;
                          const isHistoryOpen = historyTarget === response.id;
                          return (
                            <div key={response.id}>
                              <p className="checklist-history-detail__response">
                                <span className="checklist-history-detail__response-text">
                                  {formatTimeLabel(response.respondedAt)} — {response.employeeFullName}
                                  {response.empId ? ` (${response.empId})` : ''}
                                  {' — '}
                                  {formatResponseValue(response)}
                                </span>
                                {response.latestCorrection && !isHistoryOpen && (
                                  <button
                                    type="button"
                                    className="checklist-history-detail__corrected-badge"
                                    title="View correction history"
                                    onClick={() => {
                                      setCorrectionTarget(null);
                                      setHistoryTarget(isHistoryOpen ? null : response.id);
                                    }}
                                  >
                                    <History size={10} />
                                    Corrected
                                  </button>
                                )}
                                {!isEditOpen && (
                                  <button
                                    type="button"
                                    className="checklist-history-detail__edit-btn"
                                    title="Correct this response"
                                    aria-label={`Correct response by ${response.employeeFullName}`}
                                    onClick={() => {
                                      setHistoryTarget(null);
                                      setCorrectionTarget(
                                        isEditOpen ? null : { response, task },
                                      );
                                    }}
                                  >
                                    <Pencil size={12} />
                                  </button>
                                )}
                              </p>
                              {isEditOpen && (
                                <CorrectionForm
                                  target={{ response, task }}
                                  onSuccess={(updated) => handleCorrectionSuccess(response.id, updated)}
                                  onCancel={() => setCorrectionTarget(null)}
                                />
                              )}
                              {isHistoryOpen && (
                                <CorrectionHistoryPanel
                                  responseId={response.id}
                                  onClose={() => setHistoryTarget(null)}
                                />
                              )}
                            </div>
                          );
                        })}
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
