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
  // toggle below always lets the owner switch to the other one, including
  // one that was never recorded (backfilling it).
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
// historical correction may need either fixed. A snapshot that was never
// recorded is still correctable (the Admin backfilling it) -- the form
// renders with zeros and a "not yet recorded" subtitle instead of refusing
// to open. The audit trail shown below is the row's full `edits` list
// (already fetched with the history list, not snapshot-filtered, so both
// snapshots' history is visible without toggling back and forth), so
// there's no separate "load history" request like CorrectionModal's.
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

  // Null when this snapshot has never been recorded -- still correctable
  // (the Admin is backfilling it), so render with zeros rather than bailing.
  const current = activeSnapshot === 'START_OF_DAY' ? row.startOfDay : row.endOfDay;
  const snapshotLabel = activeSnapshot === 'START_OF_DAY' ? 'Start of Day' : 'End of Day';

  // The first save of each snapshot writes no audit row, so surface it here as
  // the opening entry: who entered it, when, and the value they entered (the
  // earliest edit's "previous" value if it has since been corrected).
  const originals = (['START_OF_DAY', 'END_OF_DAY'] as const).flatMap((key) => {
    const snap = key === 'START_OF_DAY' ? row.startOfDay : row.endOfDay;
    if (!snap?.enteredByName || !snap.enteredAt) return [];
    const firstEdit = row.edits.find((edit) => edit.snapshot === key);
    if (firstEdit && firstEdit.previousAvailable === null) return []; // backfilled -- no original entry
    const available = firstEdit ? firstEdit.previousAvailable! : snap.available;
    const dead = firstEdit ? firstEdit.previousDeadStock ?? 0 : snap.deadStock;
    return [{ key, by: snap.enteredByName, at: snap.enteredAt, available, dead }];
  });

  function handleSnapshotChange(value: string) {
    const next = value as StockCheckSnapshotKey;
    const target = next === 'START_OF_DAY' ? row!.startOfDay : row!.endOfDay;
    setActiveSnapshot(next);
    setAvailable(target?.available ?? 0);
    setDeadStock(target?.deadStock ?? 0);
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
      subtitle={
        current
          ? `${formatDateLabel(row.checkDate)} · current ${countLabel(current.available, current.deadStock)} ${row.unitOfMeasurement}`
          : `${formatDateLabel(row.checkDate)} · ${snapshotLabel} not yet recorded`
      }
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
        <FormField label="Snapshot" htmlFor="csc-snapshot">
          <Select id="csc-snapshot" options={SNAPSHOT_OPTIONS} value={activeSnapshot} onChange={handleSnapshotChange} ariaLabel="Snapshot" />
        </FormField>
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
        {row.edits.length === 0 && (
          <p className="correct-stock-check-modal__history-empty">No corrections recorded yet.</p>
        )}
        {(row.edits.length > 0 || originals.length > 0) && (
          <ul className="correct-stock-check-modal__history-list">
            {originals.map((o) => (
              <li key={`original-${o.key}`} className="correct-stock-check-modal__history-entry">
                <span className="correct-stock-check-modal__history-meta">
                  {o.key === 'START_OF_DAY' ? 'Start of Day' : 'End of Day'} entered by {o.by} · {formatDateLabel(row.checkDate)} {formatTimeLabel(o.at)}
                </span>
                <span className="correct-stock-check-modal__history-change">{countLabel(o.available, o.dead)}</span>
              </li>
            ))}
            {row.edits.map((edit, index) => (
              <li key={index} className="correct-stock-check-modal__history-entry">
                <span className="correct-stock-check-modal__history-meta">
                  {edit.snapshot === 'START_OF_DAY' ? 'Start of Day' : 'End of Day'} corrected by {edit.editedByName} · {formatDateLabel(row.checkDate)} {formatTimeLabel(edit.editedAt)}
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
