import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import type { StockSnapshot } from '../types/stockCheck';
import { formatTimeLabel } from '../utils/checklistHistoryOptions';
import { parseQty, qtyRuleHint } from '../utils/quantity';
import ButtonDots from './ButtonDots';
import CounterStepper from './CounterStepper';
import './StockSnapshotCard.css';

interface StockSnapshotCardProps {
  title: string;
  // Used to keep input ids unique across every card on the page.
  idPrefix: string;
  snapshot: StockSnapshot | null;
  isSubmitting?: boolean;
  onSave: (available: number, deadStock: number) => Promise<boolean>;
  // Contextual line shown left of the save button, e.g. "Opening Stock: 5 Gal"
  // or "Usage: 3 Gal · To Order: 6 Gal" -- supplied by the page since it
  // depends on data outside this one snapshot.
  footer?: ReactNode;
  // Badge text once saved -- defaults to "Editable Count"; End of Day uses
  // "Completed" since nothing reconciles against it the way SOD's opening
  // count does.
  savedLabel?: string;
  // False once another employee has taken this snapshot: the count is shown
  // read-only because only the first responder may edit it.
  canEdit?: boolean;
  // The item's unit -- countable units (Nos., box, bottle...) take whole numbers.
  unit?: string;
}

// One Start of Day or End of Day count for one item. The count stays
// editable once saved (re-saving updates the same snapshot, never a second
// one), so the fields are always shown rather than toggling to a read-only
// view -- the "Editable Count" / "In Progress" badge is the only thing that
// changes once it's been saved.
function StockSnapshotCard({ title, idPrefix, snapshot, isSubmitting = false, onSave, footer, savedLabel = 'Editable Count', canEdit = true, unit }: StockSnapshotCardProps) {
  const [available, setAvailable] = useState(() => (snapshot ? String(snapshot.available) : ''));
  const [deadStock, setDeadStock] = useState(() => (snapshot ? String(snapshot.deadStock) : '0'));
  const [error, setError] = useState<string | null>(null);

  const isSaved = snapshot != null;

  // Re-sync the fields when the saved snapshot changes under us (our own
  // save completing, or a reload), without clobbering a brand-new item that
  // has no snapshot yet.
  useEffect(() => {
    if (snapshot) {
      setAvailable(String(snapshot.available));
      setDeadStock(String(snapshot.deadStock));
    }
  }, [snapshot]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    const availableValue = parseQty(available, unit);
    const deadValue = parseQty(deadStock, unit);
    if (availableValue === null) {
      setError(`Enter available stock as ${qtyRuleHint(unit)}.`);
      return;
    }
    if (deadValue === null) {
      setError(`Enter dead stock as ${qtyRuleHint(unit)}.`);
      return;
    }
    if (deadValue > availableValue) {
      setError('Dead stock cannot be more than available stock.');
      return;
    }
    if (
      snapshot &&
      availableValue === snapshot.available &&
      deadValue === snapshot.deadStock
    ) {
      setError('No changes to save - the values are the same as the current ones.');
      return;
    }
    setError(null);
    await onSave(availableValue, deadValue);
  }

  return (
    <section
      className={`stock-snapshot-card${isSaved ? '' : ' stock-snapshot-card--pending'}`}
      aria-label={title}
    >
      <div className="stock-snapshot-card__header">
        <h3 className="stock-snapshot-card__title">
          <span className={`stock-snapshot-card__dot stock-snapshot-card__dot--${isSaved ? 'saved' : 'pending'}`} aria-hidden="true" />
          {title}
        </h3>
        {isSaved ? (
          <span className="badge badge--success">{savedLabel}</span>
        ) : (
          <span className="badge badge--danger">In Progress</span>
        )}
      </div>

      {snapshot && (
        <p className="stock-snapshot-card__meta">
          {snapshot.lastUpdatedAt && <>{formatTimeLabel(snapshot.lastUpdatedAt)} · </>}
          Verified by {snapshot.lastUpdatedByName ?? 'Unknown'}
        </p>
      )}

      <form className="stock-snapshot-card__form" onSubmit={handleSubmit} noValidate>
        <div className="stock-snapshot-card__fields">
          <div className="stock-snapshot-card__field">
            <label className="stock-snapshot-card__label" htmlFor={`${idPrefix}-available`}>Total Stock</label>
            <CounterStepper
              id={`${idPrefix}-available`}
              value={available}
              unit={unit}
              disabled={isSubmitting || !canEdit}
              onChange={setAvailable}
            />
          </div>
          <div className="stock-snapshot-card__field">
            <label className="stock-snapshot-card__label" htmlFor={`${idPrefix}-dead`}>Dead / Spoilage</label>
            <CounterStepper
              id={`${idPrefix}-dead`}
              value={deadStock}
              unit={unit}
              disabled={isSubmitting || !canEdit}
              onChange={setDeadStock}
            />
          </div>
        </div>
        {error && <p className="stock-snapshot-card__error" role="alert">{error}</p>}
        <div className="stock-snapshot-card__actions">
          <span className="stock-snapshot-card__footer-text">{footer}</span>
          {canEdit ? (
            <button type="submit" className={`btn ${isSaved ? 'btn--secondary' : 'btn--danger'}`} disabled={isSubmitting}>
              {isSubmitting ? <ButtonDots /> : isSaved ? 'Update Count' : 'Save Check'}
            </button>
          ) : (
            <span className="stock-snapshot-card__footer-text">Only {snapshot?.enteredByName ?? 'the first responder'} can edit this count</span>
          )}
        </div>
      </form>
    </section>
  );
}

export default StockSnapshotCard;
