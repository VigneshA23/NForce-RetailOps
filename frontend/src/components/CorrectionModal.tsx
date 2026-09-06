import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import { correctResponse, getCorrectionHistory, type AdminCorrectionRequestBody } from '../api/checklistHistory';
import type { AdminCorrectionEntry, ChecklistHistoryResponseEntry, ChecklistHistoryTaskItem } from '../types/checklistHistory';
import { formatDateLabel, formatTimeLabel } from '../utils/checklistHistoryOptions';
import Modal from './Modal';
import './CorrectionModal.css';

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  responseEntry: ChecklistHistoryResponseEntry;
  task: ChecklistHistoryTaskItem;
  onSaved: (updatedResponse: ChecklistHistoryResponseEntry) => void;
}

function boolLabel(value: boolean | null, responseType: string): string {
  if (value === null) return '—';
  if (responseType === 'YES_NO') return value ? 'Yes' : 'No';
  return value ? 'Done' : 'Not done';
}

function correctionValueLabel(entry: AdminCorrectionEntry, task: ChecklistHistoryTaskItem, which: 'original' | 'corrected'): string {
  const b = which === 'original' ? entry.originalValueBoolean : entry.correctedValueBoolean;
  const n = which === 'original' ? entry.originalValueNumeric : entry.correctedValueNumeric;
  const t = which === 'original' ? entry.originalValueText : entry.correctedValueText;
  if (b !== null) return boolLabel(b, task.responseType);
  if (n !== null) return task.numericUnit ? `${n} ${task.numericUnit}` : String(n);
  return t ?? '—';
}

function CorrectionModal({ isOpen, onClose, responseEntry, task, onSaved }: CorrectionModalProps) {
  const [correctedBoolean, setCorrectedBoolean] = useState<boolean | null>(null);
  const [correctedNumeric, setCorrectedNumeric] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<AdminCorrectionEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyFetched = useRef(false);

  useEffect(() => {
    if (!isOpen) return;
    setCorrectedBoolean(responseEntry.booleanValue);
    setCorrectedNumeric(responseEntry.numericValue !== null ? String(responseEntry.numericValue) : '');
    setCorrectedText(responseEntry.textValue ?? '');
    setReason('');
    setSubmitError(null);
    setShowHistory(false);
    setHistory(null);
    setHistoryError(null);
    historyFetched.current = false;
  }, [isOpen, responseEntry]);

  function loadHistory() {
    if (historyFetched.current) return;
    historyFetched.current = true;
    setHistoryLoading(true);
    setHistoryError(null);
    getCorrectionHistory(responseEntry.id)
      .then(setHistory)
      .catch((error: Error) => setHistoryError(error.message))
      .finally(() => setHistoryLoading(false));
  }

  function handleShowHistory() {
    setShowHistory(true);
    loadHistory();
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;

    setSubmitting(true);
    setSubmitError(null);

    const body: AdminCorrectionRequestBody = { reason: reason.trim() };
    if (task.responseType === 'YES_NO' || task.responseType === 'DONE_NOT_DONE') {
      body.correctedBooleanValue = correctedBoolean;
    } else if (task.responseType === 'NUMERIC') {
      body.correctedNumericValue = correctedNumeric !== '' ? Number(correctedNumeric) : null;
    } else {
      body.correctedTextValue = correctedText || null;
    }

    correctResponse(responseEntry.id, body)
      .then((result) => {
        onSaved(result.updatedResponse);
        onClose();
      })
      .catch((error: Error) => setSubmitError(error.message))
      .finally(() => setSubmitting(false));
  }

  const isBool = task.responseType === 'YES_NO' || task.responseType === 'DONE_NOT_DONE';
  const isNumeric = task.responseType === 'NUMERIC';

  const currentDisplayValue =
    responseEntry.booleanValue !== null
      ? boolLabel(responseEntry.booleanValue, task.responseType)
      : responseEntry.numericValue !== null
        ? task.numericUnit
          ? `${responseEntry.numericValue} ${task.numericUnit}`
          : String(responseEntry.numericValue)
        : (responseEntry.textValue ?? '—');

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Correct Response"
      subtitle={`${task.name} · ${responseEntry.employeeFullName}`}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            form="correction-form"
            className="btn btn--primary"
            disabled={submitting || !reason.trim()}
          >
            <Pencil size={14} />
            {submitting ? 'Saving…' : 'Save Correction'}
          </button>
        </>
      }
    >
      <form id="correction-form" onSubmit={handleSubmit} className="correction-modal__form">
        <div className="correction-modal__current-value">
          <span className="correction-modal__current-label">Current recorded value</span>
          <span className="correction-modal__current-display">{currentDisplayValue}</span>
          {responseEntry.latestCorrection && (
            <span className="correction-modal__already-corrected">Previously corrected</span>
          )}
        </div>

        <div className="correction-modal__field">
          <label className="correction-modal__label">
            Corrected value
          </label>
          {isBool && (
            <div className="correction-modal__bool-group">
              {(task.responseType === 'YES_NO' ? ['Yes', 'No'] : ['Done', 'Not done']).map((label, i) => {
                const val = i === 0;
                return (
                  <label key={label} className="correction-modal__bool-option">
                    <input
                      type="radio"
                      name="corrected-bool"
                      checked={correctedBoolean === val}
                      onChange={() => setCorrectedBoolean(val)}
                    />
                    {label}
                  </label>
                );
              })}
            </div>
          )}
          {isNumeric && (
            <div className="correction-modal__numeric-row">
              <input
                type="number"
                className="correction-modal__input"
                value={correctedNumeric}
                onChange={(e) => setCorrectedNumeric(e.target.value)}
                step="any"
                placeholder="0"
              />
              {task.numericUnit && (
                <span className="correction-modal__unit">{task.numericUnit}</span>
              )}
            </div>
          )}
          {!isBool && !isNumeric && (
            <input
              type="text"
              className="correction-modal__input"
              value={correctedText}
              onChange={(e) => setCorrectedText(e.target.value)}
              placeholder="Corrected value"
            />
          )}
        </div>

        <div className="correction-modal__field">
          <label className="correction-modal__label">
            Reason <span className="correction-modal__required">*</span>
          </label>
          <textarea
            className="correction-modal__textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why is this response being corrected?"
            rows={3}
            required
          />
        </div>

        {submitError && <p className="correction-modal__error">{submitError}</p>}
      </form>

      {!showHistory ? (
        <button
          type="button"
          className="correction-modal__history-link"
          onClick={handleShowHistory}
        >
          View correction history
        </button>
      ) : (
        <div className="correction-modal__history">
          <h4 className="correction-modal__history-heading">Correction history</h4>
          {historyLoading && <p className="correction-modal__history-empty">Loading…</p>}
          {historyError && <p className="correction-modal__history-empty correction-modal__error">{historyError}</p>}
          {history !== null && history.length === 0 && (
            <p className="correction-modal__history-empty">No corrections recorded yet.</p>
          )}
          {history !== null && history.length > 0 && (
            <ul className="correction-modal__history-list">
              {history.map((entry) => (
                <li key={entry.id} className="correction-modal__history-entry">
                  <span className="correction-modal__history-meta">
                    {entry.correctedByFullName} · {formatDateLabel(entry.correctedAt.slice(0, 10))} {formatTimeLabel(entry.correctedAt)}
                  </span>
                  <span className="correction-modal__history-change">
                    {correctionValueLabel(entry, task, 'original')}
                    {' → '}
                    {correctionValueLabel(entry, task, 'corrected')}
                  </span>
                  {entry.reason && (
                    <span className="correction-modal__history-reason">"{entry.reason}"</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Modal>
  );
}

export default CorrectionModal;
