import { useState, type FormEvent } from 'react';
import { CheckCircle2, Info, Loader2 } from 'lucide-react';
import type { MissedEndOfDay, MissedEndOfDayItem } from '../types/notification';
import type { MissedEndOfDayAnswer } from '../api/stockChecks';
import { isQtyInputAllowed, parseQty, qtyRuleHint } from '../utils/quantity';
import { countWords, MIN_SKIP_REASON_WORDS } from '../utils/wordCount';
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

interface RowProps {
  date: string;
  item: MissedEndOfDayItem;
  onAnswer: MissedEndOfDayPanelProps['onAnswer'];
  onAnswered: MissedEndOfDayPanelProps['onAnswered'];
}

function MissedRow({ date, item, onAnswer, onAnswered }: RowProps) {
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

  if (item.status !== 'PENDING') {
    const counted = item.status === 'COUNTED';
    return (
      <li className="nfp-missed__item nfp-missed__item--done">
        <div className="nfp-missed__head">
          <CheckCircle2 size={15} aria-hidden="true" />
          <strong>{item.itemName}</strong>
        </div>
        <p className="nfp-missed__done">
          {counted
            ? `Counted ${item.endOfDayAvailable ?? '—'} ${item.unitOfMeasurement}${item.endOfDayDeadStock ? ` (${item.endOfDayDeadStock} dead)` : ''}`
            : 'Could not be counted'}
          {item.answeredByName ? ` · ${item.answeredByName}` : ''}
          {item.answeredAt ? ` · ${new Date(item.answeredAt).toLocaleString()}` : ''}
        </p>
        {!counted && item.reason && <p className="nfp-missed__reason">{item.reason}</p>}
      </li>
    );
  }

  return (
    <li className="nfp-missed__item">
      <form onSubmit={submit} noValidate>
        <div className="nfp-missed__head">
          <strong>{item.itemName}</strong>
          <span className="nfp-missed__meta">
            Start of Day {dateLabel(date)}: {item.startOfDayUsable ?? '—'} {item.unitOfMeasurement}
          </span>
        </div>

        <div className="nfp-missed__modes" role="group" aria-label={`How to answer for ${item.itemName}`}>
          <button type="button" className={mode === 'count' ? 'is-active' : ''} onClick={() => { setMode('count'); setError(null); }}>
            Enter count
          </button>
          <button type="button" className={mode === 'skip' ? 'is-active' : ''} onClick={() => { setMode('skip'); setError(null); }}>
            Couldn&apos;t count
          </button>
        </div>

        {mode === 'count' ? (
          <div className="nfp-missed__fields">
            <label htmlFor={`${idBase}-available`}>
              Available ({item.unitOfMeasurement})
              <input
                id={`${idBase}-available`}
                className="input"
                inputMode="decimal"
                value={available}
                disabled={busy}
                onChange={(e) => { if (isQtyInputAllowed(e.target.value, item.unitOfMeasurement)) setAvailable(e.target.value); }}
              />
            </label>
            <label htmlFor={`${idBase}-dead`}>
              Dead / Spoilage
              <input
                id={`${idBase}-dead`}
                className="input"
                inputMode="decimal"
                value={deadStock}
                disabled={busy}
                onChange={(e) => { if (isQtyInputAllowed(e.target.value, item.unitOfMeasurement)) setDeadStock(e.target.value); }}
              />
            </label>
          </div>
        ) : (
          <div className="nfp-missed__skip">
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
            <span className={`nfp-missed__words${words >= MIN_SKIP_REASON_WORDS ? ' is-enough' : ''}`}>
              {words} / {MIN_SKIP_REASON_WORDS} words minimum
            </span>
          </div>
        )}

        {error && <p className="nfp-missed__error" role="alert">{error}</p>}
        <button type="submit" className="nfp-missed__submit" disabled={busy}>
          {busy ? <Loader2 size={13} className="nfp-spin" /> : null}
          {mode === 'count' ? 'Save End of Day' : 'Submit reason'}
        </button>
      </form>
    </li>
  );
}

// Everything counted at Start of Day yesterday with no End of Day. Each row is
// answered on its own and only the first answer from anyone in the store is
// kept, so a row someone else answered shows who did.
function MissedEndOfDayPanel({ missedEod, onAnswer, onAnswered }: MissedEndOfDayPanelProps) {
  const pending = missedEod.items.filter((i) => i.status === 'PENDING').length;
  return (
    <section className="nfp-missed" aria-label="Missing End of Day counts">
      <p className="nfp-missed__kind">
        <Info size={13} aria-hidden="true" />
        {pending === 0
          ? 'All answered'
          : `${pending} of ${missedEod.items.length} still need an End of Day for ${dateLabel(missedEod.date)}`}
      </p>
      <p className="nfp-missed__summary">
        Start of Day stays blocked for an item until its End of Day is counted or explained. Only the first
        response is kept, and it is recorded under the name of whoever gives it.
      </p>
      <ul className="nfp-missed__list">
        {missedEod.items.map((item) => (
          <MissedRow
            key={item.storeInventoryItemId}
            date={missedEod.date}
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
