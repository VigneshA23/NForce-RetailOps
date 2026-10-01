import { useState, type FormEvent } from 'react';
import { Pencil } from 'lucide-react';
import type { StockSnapshot } from '../types/stockCheck';
import { formatTimeLabel } from '../utils/checklistHistoryOptions';
import ButtonDots from './ButtonDots';
import './StockSnapshotCard.css';

interface StockSnapshotCardProps {
  title: string;
  // Used to keep input ids unique across every card on the page.
  idPrefix: string;
  unit: string;
  snapshot: StockSnapshot | null;
  isSubmitting?: boolean;
  onSave: (available: number, deadStock: number) => Promise<boolean>;
}

function parseCount(text: string): number | null {
  if (text.trim() === '') return null;
  const value = Number(text);
  return Number.isInteger(value) && value >= 0 ? value : null;
}

// One Start of Day or End of Day count for one item. Shows the saved values
// with who/when once taken; the form appears while it's pending or being
// edited. Saving again updates the same snapshot -- never a second one.
function StockSnapshotCard({ title, idPrefix, unit, snapshot, isSubmitting = false, onSave }: StockSnapshotCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [available, setAvailable] = useState('');
  const [deadStock, setDeadStock] = useState('0');
  const [error, setError] = useState<string | null>(null);

  const showForm = snapshot === null || isEditing;

  function startEditing() {
    if (!snapshot) return;
    setAvailable(String(snapshot.available));
    setDeadStock(String(snapshot.deadStock));
    setError(null);
    setIsEditing(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const availableValue = parseCount(available);
    const deadValue = parseCount(deadStock);
    if (availableValue === null) {
      setError('Enter available stock as a whole number (0 or more).');
      return;
    }
    if (deadValue === null) {
      setError('Enter dead stock as a whole number (0 or more).');
      return;
    }
    if (deadValue > availableValue) {
      setError('Dead stock cannot be more than available stock.');
      return;
    }
    setError(null);
    const saved = await onSave(availableValue, deadValue);
    if (saved) {
      setIsEditing(false);
      setAvailable('');
      setDeadStock('0');
    }
  }

  return (
    <section className="stock-snapshot-card" aria-label={title}>
      <div className="stock-snapshot-card__header">
        <h3 className="stock-snapshot-card__title">{title}</h3>
        {snapshot ? (
          <span className="badge badge--success">Completed</span>
        ) : (
          <span className="badge badge--warning">Pending</span>
        )}
      </div>

      {showForm ? (
        <form className="stock-snapshot-card__form" onSubmit={handleSubmit} noValidate>
          <div className="stock-snapshot-card__fields">
            <label className="stock-snapshot-card__field" htmlFor={`${idPrefix}-available`}>
              <span className="stock-snapshot-card__label">Available Stock</span>
              <input
                id={`${idPrefix}-available`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="input"
                value={available}
                disabled={isSubmitting}
                onChange={(event) => setAvailable(event.target.value)}
              />
            </label>
            <label className="stock-snapshot-card__field" htmlFor={`${idPrefix}-dead`}>
              <span className="stock-snapshot-card__label">Dead Stock</span>
              <input
                id={`${idPrefix}-dead`}
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                className="input"
                value={deadStock}
                disabled={isSubmitting}
                onChange={(event) => setDeadStock(event.target.value)}
              />
            </label>
          </div>
          {error && <p className="stock-snapshot-card__error" role="alert">{error}</p>}
          <div className="stock-snapshot-card__actions">
            {isEditing && (
              <button type="button" className="btn btn--secondary" disabled={isSubmitting} onClick={() => setIsEditing(false)}>
                Cancel
              </button>
            )}
            <button type="submit" className="btn btn--primary" disabled={isSubmitting}>
              {isSubmitting ? <ButtonDots /> : isEditing ? 'Update' : 'Save'}
            </button>
          </div>
        </form>
      ) : (
        <>
          <dl className="stock-snapshot-card__values">
            <div>
              <dt>Available</dt>
              <dd>{snapshot.available} <span className="stock-snapshot-card__unit">{unit}</span></dd>
            </div>
            <div>
              <dt>Dead Stock</dt>
              <dd>{snapshot.deadStock}</dd>
            </div>
            <div>
              <dt>Usable</dt>
              <dd>{snapshot.usable}</dd>
            </div>
          </dl>
          <p className="stock-snapshot-card__meta">
            Checked by {snapshot.lastUpdatedByName ?? 'Unknown'}
            {snapshot.lastUpdatedAt && <> · Last updated {formatTimeLabel(snapshot.lastUpdatedAt)}</>}
          </p>
          {snapshot.edited && snapshot.enteredByName && (
            <p className="stock-snapshot-card__meta">
              First entered by {snapshot.enteredByName}
              {snapshot.enteredAt && <> at {formatTimeLabel(snapshot.enteredAt)}</>}
            </p>
          )}
          <div className="stock-snapshot-card__actions">
            <button type="button" className="btn btn--secondary" onClick={startEditing}>
              <Pencil size={14} aria-hidden="true" />
              Edit
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default StockSnapshotCard;
