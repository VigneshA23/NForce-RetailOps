import { useEffect, useMemo, useState } from 'react';
import PopoverDateField from './PopoverDateField';
import FormField from './FormField';
import type {
  CashActorRole,
  CashFigures,
  CashHistory,
  CashHistoryEvent,
  CashHistoryEventType,
  CashHistoryStatusFilter,
} from '../types/storeCash';
import { formatCurrency } from '../utils/currency';
import './CashHistoryPanel.css';

interface CashHistoryPanelProps {
  // Loads the history for the caller's scope (Owner/Admin, Super Admin's
  // chosen store, or the employee's own entries).
  load: (from: string, to: string, status: CashHistoryStatusFilter, signal: AbortSignal) => Promise<CashHistory>;
  // Changing this (the store, or after a save/flag) reloads the list.
  reloadKey: string | number;
}

const EVENT_LABELS: Record<CashHistoryEventType, string> = {
  CREATED: 'Created',
  EMPLOYEE_EDIT: 'Employee edit',
  ADMIN_CORRECTION: 'Admin correction',
  FLAGGED: 'Flagged',
  FLAG_EDITED: 'Flag comment edited',
  FLAG_RESOLVED: 'Flag resolved',
  FLAG_REMOVED: 'Flag removed',
};

const FIGURE_LABELS: Array<[keyof CashFigures, string]> = [
  ['openingDrawerCash', 'Opening drawer cash'],
  ['cashRemoved', 'Cash removed'],
  ['cashRemaining', 'Cash remaining'],
  ['otherAdjustments', 'Other adjustments'],
];

const ROLE_LABELS: Record<CashActorRole, string> = {
  EMPLOYEE: 'Employee',
  OWNER_ADMIN: 'Owner/Admin',
  SUPER_ADMIN: 'Super Admin',
};

function dateKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 29);
  return { from: dateKey(from), to: dateKey(to) };
}

function formatWhen(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function money(value: number | null): string {
  return value === null ? 'not set' : formatCurrency(value);
}

function formatDay(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Figures as "label: old → new" for the ones that changed; CREATED shows the
// starting figures.
function FigureChanges({ event }: { event: CashHistoryEvent }) {
  if (event.type === 'CREATED' && event.current) {
    return (
      <ul className="cash-history__figures">
        {FIGURE_LABELS.map(([key, label]) => (
          <li key={key}>{label}: {money(event.current![key])}</li>
        ))}
      </ul>
    );
  }
  if (!event.previous || !event.current) return <span className="cash-history__muted">No figure change</span>;
  const changed = FIGURE_LABELS.filter(([key]) => event.previous![key] !== event.current![key]);
  if (changed.length === 0) return <span className="cash-history__muted">No figure change</span>;
  return (
    <ul className="cash-history__figures">
      {changed.map(([key, label]) => (
        <li key={key}>
          {label}: {money(event.previous![key])} → {money(event.current![key])}
        </li>
      ))}
    </ul>
  );
}

// Append-only history of cash entries (RTS-558): read-only, filterable by
// flag status and date range. Rows are listed newest first.
function CashHistoryPanel({ load, reloadKey }: CashHistoryPanelProps) {
  const initial = useMemo(defaultRange, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [status, setStatus] = useState<CashHistoryStatusFilter>('ALL');
  const [events, setEvents] = useState<CashHistoryEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (from > to) {
      setEvents([]);
      setError('The start date must be on or before the end date.');
      return;
    }
    const controller = new AbortController();
    setEvents(null);
    setError(null);
    load(from, to, status, controller.signal)
      .then((result) => setEvents(result.events))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setEvents([]);
        setError(cause instanceof Error ? cause.message : 'Could not load the history.');
      });
    return () => controller.abort();
  }, [load, from, to, status, reloadKey, retry]);

  return (
    <section className="cash-history" aria-label="Cash entry history">
      <h3 className="cash-history__title">Entry history</h3>
      <div className="cash-history__filters">
        <FormField label="From" htmlFor="cash-history-from">
          <PopoverDateField id="cash-history-from" value={from} max={to} onChange={(v) => { if (v) setFrom(v); }} />
        </FormField>
        <FormField label="To" htmlFor="cash-history-to">
          <PopoverDateField id="cash-history-to" value={to} min={from} max={dateKey(new Date())} onChange={(v) => { if (v) setTo(v); }} />
        </FormField>
        <FormField label="Flag status" htmlFor="cash-history-status">
          <select
            id="cash-history-status"
            className="input"
            value={status}
            onChange={(event) => setStatus(event.target.value as CashHistoryStatusFilter)}
          >
            <option value="ALL">All entries</option>
            <option value="OPEN">Open flags</option>
            <option value="RESOLVED">Resolved flags</option>
          </select>
        </FormField>
      </div>

      {error && (
        <p className="cash-history__error" role="alert">
          {error}{' '}
          <button type="button" className="btn btn--secondary" onClick={() => setRetry((n) => n + 1)}>Retry</button>
        </p>
      )}
      {!error && events === null && <p className="cash-history__muted">Loading…</p>}
      {!error && events !== null && events.length === 0 && (
        <p className="cash-history__muted">No cash entry activity in this range.</p>
      )}
      {events !== null && events.length > 0 && (
        <ol className="cash-history__list">
          {events.map((event, index) => (
            <li key={`${event.entryId}-${event.type}-${event.at}-${index}`} className="cash-history__item">
              <div className="cash-history__head">
                <span className={`cash-history__type cash-history__type--${event.type.toLowerCase()}`}>
                  {EVENT_LABELS[event.type]}
                </span>
                <span className="cash-history__day">Entry for {formatDay(event.businessDate)}</span>
              </div>
              <div className="cash-history__meta">
                {event.actorName ?? 'Unknown'}
                {event.actorRole ? ` (${ROLE_LABELS[event.actorRole]})` : ''} · {formatWhen(event.at)}
              </div>
              <FigureChanges event={event} />
              {event.comment && <div className="cash-history__comment">“{event.comment}”</div>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export default CashHistoryPanel;
