import { useState, type FormEvent } from 'react';
import { AlertCircle, CheckCircle2, Clock, Info, Loader2, MessageSquare } from 'lucide-react';
import type { MissedEndOfDay, MissedEndOfDayItem } from '../types/notification';
import type { MissedEndOfDayAnswer } from '../api/stockChecks';
import { formatQty, isQtyInputAllowed, parseQty, qtyRuleHint } from '../utils/quantity';
import { countWords, MIN_SKIP_REASON_WORDS } from '../utils/wordCount';
import ItemIcon from './ItemIcon';
import './MissedEndOfDayPanel.css';

interface MissedEndOfDayPanelProps {
  missedEod: MissedEndOfDay;
  // Sends one item's answer; resolves with the item's new state. Rejects with
  // the server's message when someone else answered first.
  onAnswer: (answer: MissedEndOfDayAnswer) => Promise<MissedEndOfDayItem>;
  onAnswered: (item: MissedEndOfDayItem) => void;
}

function dateLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// "Oct 22, 6:42 PM" -- same who/when phrasing used for a stock count's last
// update elsewhere in the app (see utils/stockUpdateStatus.ts).
function answeredAtLabel(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

interface CardProps {
  item: MissedEndOfDayItem;
  onAnswer: MissedEndOfDayPanelProps['onAnswer'];
  onAnswered: MissedEndOfDayPanelProps['onAnswered'];
}

function MissedCard({ item, onAnswer, onAnswered }: CardProps) {
  const [mode, setMode] = useState<'count' | 'skip'>('count');
  const [available, setAvailable] = useState('');
  const [deadStock, setDeadStock] = useState('0');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const idBase = `missed-eod-${item.storeInventoryItemId}`;
  const words = countWords(reason);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    let answer: MissedEndOfDayAnswer;
    if (mode === 'count') {
      const availableValue = parseQty(available, item.unitOfMeasurement);
      const deadValue = parseQty(deadStock, item.unitOfMeasurement);
      if (availableValue === null || deadValue === null) {
        setError(`Enter the quantities as ${qtyRuleHint(item.unitOfMeasurement)}.`);
        return;
      }
      if (deadValue > availableValue) {
        setError('Dead stock cannot be more than available stock.');
        return;
      }
      answer = { storeInventoryItemId: item.storeInventoryItemId, available: availableValue, deadStock: deadValue };
    } else {
      if (words < MIN_SKIP_REASON_WORDS) {
        setError(`Explain why it could not be counted in at least ${MIN_SKIP_REASON_WORDS} words (${words} so far).`);
        return;
      }
      answer = { storeInventoryItemId: item.storeInventoryItemId, couldNotCount: true, reason: reason.trim() };
    }
    setBusy(true);
    try {
      onAnswered(await onAnswer(answer));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  const openingStock = (
    <span className="meod-card__subtitle">
      Opening stock: {item.startOfDayUsable ?? '—'} {item.unitOfMeasurement}
    </span>
  );

  if (item.status === 'COUNTED') {
    return (
      <li className="meod-card meod-card--counted">
        <div className="meod-card__header">
          <ItemIcon id={item.storeInventoryItemId} name={item.itemName} size="md" />
          <div className="meod-card__title">
            <strong>{item.itemName}</strong>
            {openingStock}
          </div>
          <span className="badge badge--success meod-card__badge">
            <CheckCircle2 size={13} aria-hidden="true" />
            Counted
          </span>
        </div>
        <div className="meod-card__fields meod-card__fields--readonly">
          <div className="meod-card__field">
            <span className="meod-card__field-label">Available stock ({item.unitOfMeasurement})</span>
            <div className="meod-card__field-value">{formatQty(item.endOfDayAvailable) || '—'}</div>
          </div>
          <div className="meod-card__field">
            <span className="meod-card__field-label">Damaged / spoiled stock ({item.unitOfMeasurement})</span>
            <div className="meod-card__field-value">{formatQty(item.endOfDayDeadStock) || '0'}</div>
          </div>
        </div>
        <p className="meod-card__footer">
          Counted by {item.answeredByName ?? 'Unknown'}
          {item.answeredAt ? ` · ${answeredAtLabel(item.answeredAt)}` : ''}
        </p>
      </li>
    );
  }

  if (item.status === 'COULD_NOT_COUNT') {
    return (
      <li className="meod-card meod-card--explained">
        <div className="meod-card__header">
          <ItemIcon id={item.storeInventoryItemId} name={item.itemName} size="md" />
          <div className="meod-card__title">
            <strong>{item.itemName}</strong>
            {openingStock}
          </div>
          <span className="badge badge--info meod-card__badge">
            <MessageSquare size={13} aria-hidden="true" />
            Explained
          </span>
        </div>
        <div className="meod-card__note">
          <p className="meod-card__note-head">
            <CheckCircle2 size={14} aria-hidden="true" />
            Couldn&apos;t count
          </p>
          <p className="meod-card__note-body">{item.reason}</p>
        </div>
        <p className="meod-card__footer">
          Submitted by {item.answeredByName ?? 'Unknown'}
          {item.answeredAt ? ` · ${answeredAtLabel(item.answeredAt)}` : ''}
        </p>
      </li>
    );
  }

  return (
    <li className="meod-card meod-card--pending">
      <form onSubmit={submit} noValidate>
        <div className="meod-card__header">
          <ItemIcon id={item.storeInventoryItemId} name={item.itemName} size="md" />
          <div className="meod-card__title">
            <strong>{item.itemName}</strong>
            {openingStock}
          </div>
          <span className="badge badge--warning meod-card__badge">
            <AlertCircle size={13} aria-hidden="true" />
            Needs count
          </span>
        </div>

        <div className="meod-card__choice" role="radiogroup" aria-label={`How to answer for ${item.itemName}`}>
          <label className={`meod-card__choice-option${mode === 'count' ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name={`${idBase}-mode`}
              checked={mode === 'count'}
              disabled={busy}
              onChange={() => { setMode('count'); setError(null); }}
            />
            I counted this item
          </label>
          <label className={`meod-card__choice-option${mode === 'skip' ? ' is-selected' : ''}`}>
            <input
              type="radio"
              name={`${idBase}-mode`}
              checked={mode === 'skip'}
              disabled={busy}
              onChange={() => { setMode('skip'); setError(null); }}
            />
            I couldn&apos;t count it
          </label>
        </div>

        {mode === 'count' ? (
          <div className="meod-card__fields">
            <label htmlFor={`${idBase}-available`}>
              Available stock ({item.unitOfMeasurement})
              <input
                id={`${idBase}-available`}
                className="input"
                inputMode="decimal"
                placeholder={`e.g. ${item.unitOfMeasurement === 'L' ? '5.5' : '5'}`}
                value={available}
                disabled={busy}
                onChange={(e) => { if (isQtyInputAllowed(e.target.value, item.unitOfMeasurement)) setAvailable(e.target.value); }}
              />
            </label>
            <label htmlFor={`${idBase}-dead`}>
              Damaged / spoiled stock ({item.unitOfMeasurement})
              <input
                id={`${idBase}-dead`}
                className="input"
                inputMode="decimal"
                placeholder="e.g. 0"
                value={deadStock}
                disabled={busy}
                onChange={(e) => { if (isQtyInputAllowed(e.target.value, item.unitOfMeasurement)) setDeadStock(e.target.value); }}
              />
            </label>
          </div>
        ) : (
          <div className="meod-card__skip">
            <label htmlFor={`${idBase}-reason`}>Why could it not be counted?</label>
            <textarea
              id={`${idBase}-reason`}
              className="input"
              rows={3}
              maxLength={1000}
              value={reason}
              disabled={busy}
              onChange={(e) => setReason(e.target.value)}
            />
            <span className={`meod-card__words${words >= MIN_SKIP_REASON_WORDS ? ' is-enough' : ''}`}>
              {words} / {MIN_SKIP_REASON_WORDS} words minimum
            </span>
          </div>
        )}

        <p className="meod-card__hint">
          <Info size={13} aria-hidden="true" />
          Awaiting your response. Please enter the count, or provide a reason with details.
        </p>

        {error && <p className="meod-card__error" role="alert">{error}</p>}

        <button type="submit" className="meod-card__submit" disabled={busy}>
          {busy ? <Loader2 size={13} className="nfp-spin" aria-hidden="true" /> : null}
          {mode === 'count' ? 'Save End of Day' : 'Submit reason'}
        </button>
      </form>
    </li>
  );
}

// Everything counted at Start of Day yesterday with no End of Day. Each card
// is answered on its own and only the first answer from anyone in the store
// is kept, so a card someone else answered shows who did.
function MissedEndOfDayPanel({ missedEod, onAnswer, onAnswered }: MissedEndOfDayPanelProps) {
  const total = missedEod.items.length;
  const counted = missedEod.items.filter((i) => i.status === 'COUNTED').length;
  const explained = missedEod.items.filter((i) => i.status === 'COULD_NOT_COUNT').length;
  const pending = total - counted - explained;
  const resolved = counted + explained;
  const pct = total === 0 ? 0 : Math.round((resolved / total) * 100);
  const day = dateLabel(missedEod.date);

  return (
    <section className="meod" aria-label="Missing End of Day counts">
      <div className="meod__progress">
        <div className="meod__progress-top">
          <span className="meod__progress-title">Stock count progress</span>
          <span className="meod__progress-count">{resolved} of {total} resolved</span>
        </div>
        <div className="meod__progress-track">
          <div className="meod__progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="meod__progress-stats">
          <span className="meod__pstat meod__pstat--success">
            <CheckCircle2 size={14} aria-hidden="true" /> {counted} Counted
          </span>
          <span className="meod__pstat meod__pstat--info">
            <MessageSquare size={14} aria-hidden="true" /> {explained} Explained
          </span>
          <span className="meod__pstat meod__pstat--warning">
            <Clock size={14} aria-hidden="true" /> {pending} Pending
          </span>
        </div>
      </div>

      <p className="meod__note">
        <Info size={13} aria-hidden="true" />
        {pending === 0
          ? `All items from ${day} are recorded or explained.`
          : `${pending} of ${total} still need an End of Day for ${day}.`}
      </p>

      <ul className="meod__list">
        {missedEod.items.map((item) => (
          <MissedCard
            key={item.storeInventoryItemId}
            item={item}
            onAnswer={onAnswer}
            onAnswered={onAnswered}
          />
        ))}
      </ul>
    </section>
  );
}

export default MissedEndOfDayPanel;
