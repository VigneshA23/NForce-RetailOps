import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  getCashHistory,
  getDailyCashEntry,
  getSuperAdminCashHistory,
  getSuperAdminDailyCashEntry,
  saveDailyCashEntry,
  saveSuperAdminDailyCashEntry,
} from '../api/storeCash';
import { getMyCashEntry, getMyCashHistory, saveMyCashEntry } from '../api/meCash';
import { ApiError } from '../api/client';
import type {
  CashAmountField,
  CashAmounts,
  CashHistoryStatusFilter,
  DailyCashCorrection,
  DailyCashEntry,
  DailyCashEntryRequest,
} from '../types/storeCash';
import FormField from '../components/FormField';
import PopoverDateField from '../components/PopoverDateField';
import ButtonDots from '../components/ButtonDots';
import ExpectedCashOnHandStat from '../components/ExpectedCashOnHandStat';
import CashTargetStat from '../components/CashTargetStat';
import CashEntryFlagSection from '../components/CashEntryFlagSection';
import CashHistoryPanel from '../components/CashHistoryPanel';
import { formatAmount, formatCurrency } from '../utils/currency';
import { parseAmount, validateAmount } from '../utils/amountInput';
import { nfToast } from '../utils/toast';
import './DailyCash.css';

interface DailyCashProps {
  // Null while stores load, when an Owner/Admin has none, or before a Super
  // Admin has picked one.
  storeId: number | null;
  storesLoading: boolean;
  // 'owner': the server resolves the caller's own store (storeId is only used
  // to know one exists). 'super-admin': storeId is sent explicitly. 'employee':
  // storeId is the store they work at; they never see expected cash or the
  // cash target, and may only change today's entry (or one flagged for them).
  scope?: 'owner' | 'super-admin' | 'employee';
  // A notification click may ask for a specific date; `id` changes on every
  // click so the current date can be refreshed as well.
  dateSeed?: { date?: string; id: number } | null;
  // Super Admin's store picker, shown beside the date.
  storeSelector?: ReactNode;
  // Shown in place of the form when storeId is null and stores have loaded.
  noStoreMessage?: string;
}

type Scope = 'owner' | 'super-admin' | 'employee';

function loadEntry(scope: Scope, storeId: number, date: string, signal: AbortSignal) {
  if (scope === 'employee') return getMyCashEntry(storeId, date, signal);
  return scope === 'super-admin'
    ? getSuperAdminDailyCashEntry(storeId, date, signal)
    : getDailyCashEntry(date, signal);
}

function saveEntry(scope: Scope, storeId: number, request: DailyCashEntryRequest) {
  if (scope === 'employee') return saveMyCashEntry(storeId, request);
  return scope === 'super-admin'
    ? saveSuperAdminDailyCashEntry(storeId, request)
    : saveDailyCashEntry(request);
}

interface FieldSpec {
  key: CashAmountField;
  label: string;
  description: string;
  // Only Other Adjustments may go below zero (money taken out of the drawer
  // for a reason none of the other fields cover), matching RTS-291.
  signed?: boolean;
  hint?: string;
}

const FIELDS: FieldSpec[] = [
  { key: 'openingDrawerCash', label: 'Opening drawer cash', description: 'Cash physically in the drawer at the start of the day.' },
  { key: 'cashExpenses', label: 'Cash expenses', description: 'Cash paid directly from the drawer for expenses during this business date.' },
  { key: 'cashRemoved', label: 'Cash removed', description: 'Cash taken out of the drawer during the day, other than amounts recorded as cash expenses.' },
  { key: 'cashRemaining', label: 'Cash remaining', description: 'Cash physically counted in the drawer at the end of the day. This is compared with Expected Cash on Hand to show the variance.' },
  { key: 'otherAdjustments', label: 'Other adjustments', description: 'A cash increase or decrease not captured by the other fields. Use a negative amount for cash taken out.', signed: true, hint: 'Use a minus sign for money taken out. Enter 0 if none.' },
];
const OPENING_CASH_FIELDS = FIELDS.filter((field) => field.key === 'openingDrawerCash');
const OTHER_CASH_FIELDS = FIELDS.filter((field) => field.key !== 'openingDrawerCash');

// Shown to Owner/Admin and Super Admin only (employees never see expected cash).
const EXPECTED_CASH_FORMULA =
  "Daily expected cash = Cash remaining ± Other adjustments. Expected Cash on Hand adds up every day's figure.";

type Values = Record<CashAmountField, string>;
type Errors = Partial<Record<CashAmountField, string>>;
type SaveSection = 'all' | 'opening' | 'cash';

const EMPTY_VALUES: Values = {
  openingDrawerCash: '',
  cashRemoved: '',
  cashRemaining: '',
  cashExpenses: '',
  otherAdjustments: '',
};

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const FUTURE_DATE_MESSAGE = 'Business date cannot be in the future';

// YYYY-MM-DD strings compare correctly as text. Typing into the native date
// input can get past its max, so this is checked separately.
function isFutureDate(value: string): boolean {
  return value > todayKey();
}

function formatDateLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

const REASON_MAX = 500;
const REASON_REQUIRED = 'Enter a reason for this correction';

const capitalise = (key: CashAmountField) => key.charAt(0).toUpperCase() + key.slice(1);

// The figures in a correction that actually changed, as label / old / new.
function changedFields(correction: DailyCashCorrection) {
  return FIELDS.flatMap((field) => {
    const before = correction[`previous${capitalise(field.key)}` as keyof DailyCashCorrection] as number;
    const after = correction[`new${capitalise(field.key)}` as keyof DailyCashCorrection] as number | null;
    if (after === null || after === before) return [];
    return [{ label: field.label, before, after }];
  });
}

// Newest first: who corrected the day, when, why, and what changed.
function CorrectionHistory({ history }: { history: DailyCashCorrection[] }) {
  if (history.length === 0) return null;
  return (
    <section className="daily-cash-page__history" aria-label="Correction history">
      <h3 className="daily-cash-page__history-title">Correction history</h3>
      <ol className="daily-cash-page__history-list">
        {[...history].reverse().map((correction) => {
          const changes = changedFields(correction);
          return (
            <li key={correction.id} className="daily-cash-page__history-item">
              <div className="daily-cash-page__history-meta">
                Corrected by {correction.correctedByName ?? 'an admin'} · {formatSavedAt(correction.correctedAt)}
              </div>
              {correction.reason && <div className="daily-cash-page__history-reason">Reason: {correction.reason}</div>}
              {changes.length > 0 && (
                <ul className="daily-cash-page__history-changes">
                  {changes.map((change) => (
                    <li key={change.label}>
                      {change.label}: {formatCurrency(change.before)} → {formatCurrency(change.after)}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function figuresChanged(entry: DailyCashEntry, values: Values): boolean {
  return FIELDS.some((field) => parseAmount(values[field.key]) !== entry[field.key]);
}

function valuesFrom(entry: DailyCashEntry): Values {
  const values = { ...EMPTY_VALUES };
  for (const field of FIELDS) values[field.key] = formatAmount(entry[field.key]);
  return values;
}

function validateField(field: FieldSpec, raw: string): string | undefined {
  return validateAmount(field.label, raw, {
    signed: field.signed,
    requiredMessage: field.signed ? `${field.label} is required (enter 0 if none)` : undefined,
  });
}

function validateAll(values: Values): Errors {
  const errors: Errors = {};
  for (const field of FIELDS) {
    const error = validateField(field, values[field.key]);
    if (error) errors[field.key] = error;
  }
  return errors;
}

// Daily Cash Entry (RTS-292): one row per store + business date, for an
// Owner/Admin's own store or any store a Super Admin picks. Picking a date
// loads whatever was saved for it, so reopening a day pre-fills it for review
// or correction. Employee edits of an existing row can save the opening and
// remaining-cash sections independently; the server still audits each save as
// a correction to the same entry.
function DailyCash({
  storeId,
  storesLoading,
  scope = 'owner',
  dateSeed = null,
  storeSelector,
  noStoreMessage = 'No store is assigned to your account yet, so there is nowhere to record cash.',
}: DailyCashProps) {
  const [businessDate, setBusinessDate] = useState(todayKey);
  const [entry, setEntry] = useState<DailyCashEntry | null>(null);
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [errors, setErrors] = useState<Errors>({});
  // Errors only show once a save has been tried; after that they track edits.
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(storeId !== null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<SaveSection | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [reason, setReason] = useState('');
  const [openingNote, setOpeningNote] = useState('');
  const [otherCashNote, setOtherCashNote] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  // Bumped after each successful save so Expected Cash on Hand refetches.
  const [expectedRefreshKey, setExpectedRefreshKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);

  // A notification asked for a specific day (the flagged entry's date).
  useEffect(() => {
    if (!dateSeed) return;
    if (dateSeed.date) setBusinessDate(dateSeed.date);
    setReloadToken((token) => token + 1);
  }, [dateSeed]);

  const loadHistory = useCallback(
    (from: string, to: string, status: CashHistoryStatusFilter, signal: AbortSignal) => {
      if (storeId === null) return Promise.reject(new Error('No store selected'));
      if (scope === 'employee') return getMyCashHistory(storeId, from, to, status, signal);
      return scope === 'super-admin'
        ? getSuperAdminCashHistory(storeId, from, to, status, signal)
        : getCashHistory(from, to, status, signal);
    },
    [scope, storeId],
  );

  useEffect(() => {
    if (storeId === null || !businessDate) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setErrors({});
    setSubmitAttempted(false);
    setReason('');
    setOpeningNote('');
    setOtherCashNote('');
    setReasonError(undefined);
    // Nothing can be saved for a future day, so there is nothing to load.
    if (isFutureDate(businessDate)) {
      setEntry(null);
      setValues(EMPTY_VALUES);
      setIsLoading(false);
      return;
    }

    loadEntry(scope, storeId, businessDate, controller.signal)
      .then((result) => {
        setEntry(result);
        setValues(result ? valuesFrom(result) : EMPTY_VALUES);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setEntry(null);
        setLoadError(cause instanceof Error ? cause.message : 'Could not load the cash entry.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [scope, storeId, businessDate, reloadToken]);

  function handleChange(field: FieldSpec, raw: string) {
    setValues((current) => ({ ...current, [field.key]: raw }));
    if (submitAttempted) {
      setErrors((current) => ({ ...current, [field.key]: validateField(field, raw) }));
    }
  }

  function handleBlur(field: FieldSpec) {
    const raw = values[field.key];
    if (validateField(field, raw)) return;
    setValues((current) => ({ ...current, [field.key]: formatAmount(parseAmount(raw)) }));
  }

  async function handleSubmit(event: FormEvent, section: SaveSection) {
    event.preventDefault();
    setSubmitAttempted(true);
    setSaveError(null);
    const note = section === 'opening' ? openingNote : section === 'cash' ? otherCashNote : reason;
    const nextErrors = validateAll(values);
    setErrors(nextErrors);
    // A changed figure on a day that is already saved is a correction.
    const isCorrection = entry !== null && Object.keys(nextErrors).length === 0 && figuresChanged(entry, values);
    // Employees are never asked for a reason: theirs is an optional note.
    const nextReasonError = isCorrection && scope !== 'employee' && !note.trim() ? REASON_REQUIRED : undefined;
    setReasonError(nextReasonError);
    if (Object.keys(nextErrors).length > 0 || nextReasonError || storeId === null || isFutureDate(businessDate)) return;

    const amounts = {} as CashAmounts;
    for (const field of FIELDS) amounts[field.key] = parseAmount(values[field.key]);

    setSavingSection(section);
    try {
      const saved = await saveEntry(scope, storeId, {
        businessDate,
        ...amounts,
        ...((isCorrection || (scope === 'employee' && entry?.flag)) && note.trim()
          ? { correctionReason: note.trim() }
          : {}),
      });
      setEntry(saved);
      setExpectedRefreshKey((key) => key + 1);
      setValues(valuesFrom(saved));
      setSubmitAttempted(false);
      if (section === 'opening') setOpeningNote('');
      else if (section === 'cash') setOtherCashNote('');
      else {
        setReason('');
        setOpeningNote('');
        setOtherCashNote('');
      }
      nfToast.success(
        entry?.flag && scope === 'employee'
          ? `Cash entry for ${formatDateLabel(businessDate)} corrected. The flag is resolved.`
          : isCorrection
          ? `Cash entry for ${formatDateLabel(businessDate)} corrected.`
          : `Cash entry for ${formatDateLabel(businessDate)} saved.`,
      );
    } catch (cause) {
      // The server's own validation (RTS-291) answers with a message per
      // field: put each under its input like the checks above, and surface
      // any that don't belong to an input in the banner.
      const fieldErrors = cause instanceof ApiError ? cause.fieldErrors : undefined;
      if (fieldErrors) {
        const serverErrors: Errors = {};
        const other: string[] = [];
        for (const [key, message] of Object.entries(fieldErrors)) {
          if (FIELDS.some((field) => field.key === key)) serverErrors[key as CashAmountField] = message;
          else other.push(message);
        }
        setErrors(serverErrors);
        setSaveError(`Not saved: ${other.length > 0 ? other.join(' ') : 'please fix the highlighted fields.'}`);
      } else {
        const message = cause instanceof Error ? cause.message : 'Could not save the cash entry.';
        setSaveError(`Not saved: ${message}`);
      }
      nfToast.error('Cash entry was not saved. Please try again.');
    } finally {
      setSavingSection(null);
    }
  }

  function renderFields(fields: FieldSpec[]) {
    return (
      <div className="daily-cash-page__grid">
        {fields.map((field) => {
          const id = `daily-cash-${field.key}`;
          const error = errors[field.key];
          return (
            <FormField
              key={field.key}
              label={field.label}
              htmlFor={id}
              description={field.description}
              required
              error={error}
            >
              <div className="daily-cash-page__money">
                <span className="daily-cash-page__currency" aria-hidden="true">$</span>
                <input
                  id={id}
                  className="input daily-cash-page__input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0.00"
                  value={values[field.key]}
                  aria-invalid={error ? true : undefined}
                  onChange={(event) => handleChange(field, event.target.value)}
                  onBlur={() => handleBlur(field)}
                />
              </div>
              {field.hint && !error && <span className="daily-cash-page__hint">{field.hint}</span>}
            </FormField>
          );
        })}
      </div>
    );
  }

  function renderEmployeeNote(id: string, value: string, onChange: (value: string) => void) {
    return (
      <div className="daily-cash-page__reason">
        <FormField
          label="Note (optional)"
          htmlFor={id}
          description={entry?.flag
            ? 'Add a note for the admin about what you fixed. Saving resolves the flag.'
            : "Add a note about this change if you like. It's kept with the entry's history."}
        >
          <textarea
            id={id}
            className="input daily-cash-page__reason-input"
            rows={2}
            maxLength={REASON_MAX}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        </FormField>
      </div>
    );
  }

  // Without a selector there is nothing to do until a store exists, so the
  // Owner/Admin sees only the message; a Super Admin keeps the picker.
  if (storeId === null && !storeSelector) {
    return (
      <div className="daily-cash-page">
        <section className="card daily-cash-page__card">
          <p className="daily-cash-page__status">
            {storesLoading ? 'Loading your store…' : noStoreMessage}
          </p>
        </section>
      </div>
    );
  }

  const errorCount = Object.values(errors).filter(Boolean).length;
  const dateIsFuture = isFutureDate(businessDate);
  const isEmployee = scope === 'employee';
  // An employee may only change today's entry, or one flagged for them (the
  // server says which via canEdit). Anything else is shown read-only.
  const readOnly = isEmployee && !isLoading && (entry ? entry.canEdit === false : businessDate !== todayKey());

  function applyEntry(next: DailyCashEntry) {
    setEntry(next);
    setValues(valuesFrom(next));
    setExpectedRefreshKey((key) => key + 1);
  }

  return (
    <div className="daily-cash-page">
      {storeId !== null && !isEmployee && (
        <div className="daily-cash-page__expected">
          <ExpectedCashOnHandStat
            scope={scope as 'owner' | 'super-admin'}
            storeId={storeId}
            date={dateIsFuture ? todayKey() : businessDate}
            refreshKey={expectedRefreshKey}
          />
          <CashTargetStat scope={scope as 'owner' | 'super-admin'} storeId={storeId} />
        </div>
      )}
      <section className="card daily-cash-page__card" aria-label="Daily cash entry">
        <div className="daily-cash-page__toolbar">
          <div className="daily-cash-page__pickers">
            {storeSelector && <div className="daily-cash-page__store">{storeSelector}</div>}
            <div className="daily-cash-page__date">
              <FormField label="Business date" htmlFor="daily-cash-date" error={dateIsFuture ? FUTURE_DATE_MESSAGE : undefined}>
                <PopoverDateField id="daily-cash-date" value={businessDate} max={todayKey()} onChange={(value) => { if (value) setBusinessDate(value); }} />
              </FormField>
            </div>
          </div>
          <div className="daily-cash-page__meta">
            {storeId !== null && (
              <p className="daily-cash-page__status" aria-live="polite">
                {isLoading
                  ? 'Loading…'
                  : loadError || dateIsFuture
                    ? null
                    : entry
                      ? entry.correctedByName && entry.correctedAt
                        ? `Corrected by ${entry.correctedByRole === 'EMPLOYEE' ? 'employee ' : ''}${entry.correctedByName} · ${formatSavedAt(entry.correctedAt)}`
                        : `Saved · last updated ${formatSavedAt(entry.updatedAt)}`
                      : 'No entry saved for this date yet'}
              </p>
            )}
            {storeId !== null && !isLoading && !loadError && !dateIsFuture && entry && (
              <p className="daily-cash-page__status daily-cash-page__entered-by">
                Entered by {entry.enteredByName ?? 'Unknown'} · {formatSavedAt(entry.enteredAt)}
              </p>
            )}
          </div>
        </div>

        {storeId !== null && !isEmployee && (
          <div className="daily-cash-page__formula-banner">
            {EXPECTED_CASH_FORMULA}
          </div>
        )}

        {storeId !== null && !isLoading && !loadError && !dateIsFuture && entry && (
          <CashEntryFlagSection entry={entry} canManage={scope === 'owner'} onEntryChange={applyEntry} />
        )}

        {readOnly && !loadError && !dateIsFuture && (
          <p className="daily-cash-page__status" role="note">
            {entry
              ? entry.flag
                ? 'This entry was flagged for the employee who entered it. Only they can correct it.'
                : 'You can only change today\'s entry. This day is read-only.'
              : 'No entry was saved for this day, and employees can only record today.'}
          </p>
        )}

        {storeId === null ? (
          <p className="daily-cash-page__status">
            {storesLoading ? 'Loading stores…' : noStoreMessage}
          </p>
        ) : loadError ? (
          <div className="daily-cash-page__alert" role="alert">
            <span>{loadError}</span>
            <button type="button" className="btn btn--secondary" onClick={() => setReloadToken((token) => token + 1)}>
              Retry
            </button>
          </div>
        ) : isEmployee && entry ? (
          <div className="daily-cash-page__employee-sections">
            <form
              className="daily-cash-page__form"
              onSubmit={(event) => handleSubmit(event, 'opening')}
              noValidate
            >
              <h3 className="daily-cash-page__section-title">Opening drawer cash</h3>
              <fieldset className="daily-cash-page__fieldset" disabled={isLoading || savingSection !== null || readOnly}>
                {renderFields(OPENING_CASH_FIELDS)}
                {!readOnly && renderEmployeeNote(
                  'daily-cash-opening-note',
                  openingNote,
                  setOpeningNote,
                )}
              </fieldset>
              <div className="daily-cash-page__actions">
                {errorCount > 0 && (
                  <span className="daily-cash-page__error-summary">
                    Fix the highlighted fields to save.
                  </span>
                )}
                {!readOnly && (
                  <button type="submit" className="btn btn--primary" disabled={isLoading || savingSection !== null || dateIsFuture}>
                    {savingSection === 'opening'
                      ? <ButtonDots label="Saving" />
                      : entry.flag ? 'Save & resolve flag' : 'Update Entry'}
                  </button>
                )}
              </div>
            </form>

            <form
              className="daily-cash-page__form"
              onSubmit={(event) => handleSubmit(event, 'cash')}
              noValidate
            >
              <h3 className="daily-cash-page__section-title">Cash removed, cash remaining and adjustments</h3>
              <fieldset className="daily-cash-page__fieldset" disabled={isLoading || savingSection !== null || readOnly}>
                {renderFields(OTHER_CASH_FIELDS)}
                {!readOnly && renderEmployeeNote(
                  'daily-cash-other-cash-note',
                  otherCashNote,
                  setOtherCashNote,
                )}
              </fieldset>
              <div className="daily-cash-page__actions">
                {errorCount > 0 && (
                  <span className="daily-cash-page__error-summary">
                    Fix the highlighted fields to save.
                  </span>
                )}
                {!readOnly && (
                  <button type="submit" className="btn btn--primary" disabled={isLoading || savingSection !== null || dateIsFuture}>
                    {savingSection === 'cash'
                      ? <ButtonDots label="Saving" />
                      : entry.flag ? 'Save & resolve flag' : 'Update Entry'}
                  </button>
                )}
              </div>
            </form>
            {saveError && <p className="daily-cash-page__alert" role="alert">{saveError}</p>}
            <div className="daily-cash-page__actions">
              <button type="button" className="btn btn--secondary" onClick={() => setShowHistory((open) => !open)}>
                {showHistory ? 'Hide history' : 'View history'}
              </button>
            </div>
            <CorrectionHistory history={entry.history} />
            {showHistory && (
              <CashHistoryPanel load={loadHistory} reloadKey={`${storeId}-${expectedRefreshKey}`} />
            )}
          </div>
        ) : (
          <form className="daily-cash-page__form" onSubmit={(event) => handleSubmit(event, 'all')} noValidate>
            <fieldset className="daily-cash-page__fieldset" disabled={isLoading || savingSection !== null || readOnly}>
              {renderFields(FIELDS)}
              {entry && !readOnly && (
                <div className="daily-cash-page__reason">
                  <FormField
                    label="Reason for correction"
                    htmlFor="daily-cash-correction-reason"
                    description="Required if you change any figure on a saved day. Kept with the entry's history."
                    error={reasonError}
                  >
                    <textarea
                      id="daily-cash-correction-reason"
                      className="input daily-cash-page__reason-input"
                      rows={2}
                      maxLength={REASON_MAX}
                      value={reason}
                      aria-invalid={reasonError ? true : undefined}
                      onChange={(event) => {
                        setReason(event.target.value);
                        if (reasonError && event.target.value.trim()) setReasonError(undefined);
                      }}
                    />
                  </FormField>
                </div>
              )}
            </fieldset>

            {saveError && (
              <p className="daily-cash-page__alert" role="alert">{saveError}</p>
            )}

            <div className="daily-cash-page__actions">
              {errorCount > 0 && (
                <span className="daily-cash-page__error-summary">
                  Fix {errorCount === 1 ? 'the highlighted field' : `the ${errorCount} highlighted fields`} to save.
                </span>
              )}
              {!readOnly && (
                <button type="submit" className="btn btn--primary" disabled={isLoading || savingSection !== null || dateIsFuture}>
                  {savingSection === 'all'
                    ? <ButtonDots label="Saving" />
                    : entry ? 'Update Entry' : 'Save Entry'}
                </button>
              )}
              <button type="button" className="btn btn--secondary" onClick={() => setShowHistory((open) => !open)}>
                {showHistory ? 'Hide history' : 'View history'}
              </button>
            </div>
            {entry && <CorrectionHistory history={entry.history} />}
            {showHistory && (
              <CashHistoryPanel load={loadHistory} reloadKey={`${storeId}-${expectedRefreshKey}`} />
            )}
          </form>
        )}
      </section>
    </div>
  );
}

export default DailyCash;
