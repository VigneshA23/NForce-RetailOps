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
  // Which snapshot to open on -- the caller's single per-row "Correct"
  // action defaults this to whichever snapshot is actually shown as "Count
  // Entered" (End of Day if present, else Start of Day). The snapshot
  // toggle below lets the owner switch to the other one when the row has
  // both.
  snapshot: StockCheckSnapshotKey | null;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSubmit: (values: CorrectStockCheckValues) => void;
}

const SNAPSHOT_OPTIONS = [
  { value: 'START_OF_DAY', label: 'Start of Day' },
  { value: 'END_OF_DAY', label: 'End of Day' },
];

// Corrects one snapshot (Start of Day or End of Day) of a past stock-check
// entry picked from StockCheckHistory -- unlike EditInventoryCountModal
// (which only ever edits the latest check and carries dead stock over
// unchanged), this form collects both available and dead stock, since a
// historical correction may need either fixed. The audit trail shown below
// comes straight from `row.edits` (already fetched with the history list),
// so there's no separate "load history" request like CorrectionModal's.
function CorrectStockCheckModal({ isOpen, row, snapshot, errorMessage, isSubmitting = false, onClose, onSubmit }: CorrectStockCheckModalProps) {
  const [activeSnapshot, setActiveSnapshot] = useState<StockCheckSnapshotKey>('START_OF_DAY');
  const [available, setAvailable] = useState(0);
  const [deadStock, setDeadStock] = useState(0);
  const [reason, setReason] = useState(REASON_OPTIONS[0].value);
  const [note, setNote] = useState('');

  // Resets everything to the snapshot the row was opened on -- re-keyed off
  // `row`/`snapshot` (not `activeSnapshot`) so switching the toggle below
  // doesn't re-trigger this.
  useEffect(() => {
    if (!isOpen || !row || !snapshot) return;
    const initial = snapshot === 'START_OF_DAY' ? row.startOfDay : row.endOfDay;
    setActiveSnapshot(snapshot);
    setAvailable(initial?.available ?? 0);
    setDeadStock(initial?.deadStock ?? 0);
    setReason(REASON_OPTIONS[0].value);
    setNote('');
  }, [isOpen, row, snapshot]);

  if (!row || !snapshot) return null;

  const current = activeSnapshot === 'START_OF_DAY' ? row.startOfDay : row.endOfDay;
  if (!current) return null;

  const edits = row.edits.filter((edit) => edit.snapshot === activeSnapshot);
  const snapshotLabel = activeSnapshot === 'START_OF_DAY' ? 'Start of Day' : 'End of Day';

  function handleSnapshotChange(value: string) {
    const next = value as StockCheckSnapshotKey;
    const target = next === 'START_OF_DAY' ? row!.startOfDay : row!.endOfDay;
    if (!target) return;
    setActiveSnapshot(next);
    setAvailable(target.available);
    setDeadStock(target.deadStock);
  }

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
        {row.startOfDay && row.endOfDay && (
          <FormField label="Snapshot" htmlFor="csc-snapshot">
            <Select id="csc-snapshot" options={SNAPSHOT_OPTIONS} value={activeSnapshot} onChange={handleSnapshotChange} ariaLabel="Snapshot" />
          </FormField>
        )}
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
