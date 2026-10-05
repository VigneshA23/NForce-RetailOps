import { useEffect, useState, type FormEvent } from 'react';
import Modal from './Modal';
import FormField from './FormField';
import Select from './Select';
import QuantityStepper from './QuantityStepper';
import ButtonDots from './ButtonDots';
import { REASON_OPTIONS } from './EditInventoryCountModal';
import type { StockCheckResponse, StockCheckSnapshotKey } from '../types/stockCheck';
import { formatDateLabel, formatTimeLabel } from '../utils/checklistHistoryOptions';
import { countLabel } from '../utils/stockCheckFormat';
import './CorrectStockCheckModal.css';

export interface CorrectStockCheckValues {
  available: number;
  deadStock: number;
  reason: string;
}

interface CorrectStockCheckModalProps {
  isOpen: boolean;
  row: StockCheckResponse | null;
  snapshot: StockCheckSnapshotKey | null;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CorrectStockCheckValues) => void;
}

// Corrects one snapshot (Start of Day or End of Day) of a past stock-check
// entry picked from StockCheckHistory -- unlike EditInventoryCountModal
// (which only ever edits the latest check and carries dead stock over
// unchanged), this form collects both available and dead stock, since a
// historical correction may need either fixed. The audit trail shown below
// comes straight from `row.edits` (already fetched with the history list),
// so there's no separate "load history" request like CorrectionModal's.
function CorrectStockCheckModal({ isOpen, row, snapshot, errorMessage, isSubmitting = false, onClose, onSubmit }: CorrectStockCheckModalProps) {
  const [available, setAvailable] = useState(0);
  const [deadStock, setDeadStock] = useState(0);
  const [reason, setReason] = useState(REASON_OPTIONS[0].value);
  const [note, setNote] = useState('');

  const current = row && snapshot ? (snapshot === 'START_OF_DAY' ? row.startOfDay : row.endOfDay) : null;

  useEffect(() => {
    if (isOpen && current) {
      setAvailable(current.available);
      setDeadStock(current.deadStock);
      setReason(REASON_OPTIONS[0].value);
      setNote('');
    }
  }, [isOpen, current]);

  if (!row || !snapshot || !current) return null;

  const edits = row.edits.filter((edit) => edit.snapshot === snapshot);
  const snapshotLabel = snapshot === 'START_OF_DAY' ? 'Start of Day' : 'End of Day';

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const reasonLabel = REASON_OPTIONS.find((option) => option.value === reason)?.label ?? reason;
    onSubmit({
      available,
      deadStock,
      reason: note.trim() ? `${reasonLabel} — ${note.trim()}` : reasonLabel,
    });
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Correct ${snapshotLabel} count: ${row.itemName}`}
      subtitle={`${formatDateLabel(row.checkDate)} · current ${countLabel(current.available, current.deadStock)} ${row.unitOfMeasurement}`}
      footer={
        <>
          <button type="button" className="btn btn--secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" form="correct-stock-check-form" className={`btn btn--primary${isSubmitting ? ' btn--loading' : ''}`} disabled={isSubmitting}>
            {isSubmitting ? <ButtonDots label="Saving" /> : 'Save correction'}
          </button>
        </>
      }
    >
      <form id="correct-stock-check-form" onSubmit={handleSubmit} noValidate>
        <FormField label="Available" htmlFor="csc-available">
          <QuantityStepper id="csc-available" value={available} unit={row.unitOfMeasurement} min={0} ariaLabel="Available" onChange={setAvailable} />
        </FormField>
        <FormField label="Dead stock" htmlFor="csc-dead-stock">
          <QuantityStepper id="csc-dead-stock" value={deadStock} unit={row.unitOfMeasurement} min={0} ariaLabel="Dead stock" onChange={setDeadStock} />
        </FormField>
        <FormField label="Reason" htmlFor="csc-reason">
          <Select id="csc-reason" options={REASON_OPTIONS} value={reason} onChange={setReason} ariaLabel="Reason" />
        </FormField>
        <FormField label="Note (optional)" htmlFor="csc-note">
          <input
            id="csc-note"
            type="text"
            className="input"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Found 2 extra in the back freezer"
          />
        </FormField>
        {errorMessage && <p className="form-field__error">{errorMessage}</p>}
      </form>

      <div className="correct-stock-check-modal__history">
        <h4 className="correct-stock-check-modal__history-heading">Correction history</h4>
        {edits.length === 0 && (
          <p className="correct-stock-check-modal__history-empty">No corrections recorded yet.</p>
        )}
        {edits.length > 0 && (
          <ul className="correct-stock-check-modal__history-list">
            {edits.map((edit, index) => (
              <li key={index} className="correct-stock-check-modal__history-entry">
                <span className="correct-stock-check-modal__history-meta">
                  Corrected by {edit.editedByName} · {formatDateLabel(row.checkDate)} {formatTimeLabel(edit.editedAt)}
                </span>
                <span className="correct-stock-check-modal__history-change">
                  {countLabel(edit.previousAvailable, edit.previousDeadStock)}
                  {' → '}
                  {countLabel(edit.newAvailable, edit.newDeadStock)}
                </span>
                {edit.reason && (
                  <span className="correct-stock-check-modal__history-reason">"{edit.reason}"</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

export default CorrectStockCheckModal;
