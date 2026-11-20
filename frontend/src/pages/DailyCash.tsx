import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  getCashHistory,
  getDailyCashEntry,
  getSuperAdminCashHistory,
  getSuperAdminDailyCashEntry,
  saveDailyCashEntry,
  saveSuperAdminDailyCashEntry,
} from '../api/storeCash';
import { getMyCashEntry, saveMyCashEntry } from '../api/meCash';
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
import ConfirmDialog from '../components/ConfirmDialog';
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
  // A notification click asks for a specific date; `id` changes on every click
  // so the same date can be requested again.
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
  // Optional fields may be left blank; a blank one is saved as 0.
  optional?: boolean;
}

const FIELDS: FieldSpec[] = [
  { key: 'openingDrawerCash', label: 'Opening drawer cash', description: 'Cash in the drawer at the start of the day. Recorded only; it does not change expected cash.' },
  { key: 'cashRemoved', label: 'Cash removed', description: 'Cash taken out of the drawer during the day. Recorded only; it does not change expected cash.' },
  { key: 'cashRemaining', label: 'Cash remaining', description: 'Cash dropped into the safe, after the removed cash. Expected cash is built from this.' },
  { key: 'otherAdjustments', label: 'Other adjustments', description: 'A cash increase or decrease not captured by the other fields. Use a negative amount for cash taken out.', signed: true, optional: true, hint: 'Optional. Use a minus sign for money taken out; leave blank for 0.' },
];

const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((field) => [field.key, field])) as Record<CashAmountField, FieldSpec>;

// Employees fill two separate forms: the opening drawer cash on its own, then
// the rest. Owner/Admin and Super Admin keep one form with every field, none of
// them mandatory: only the amounts they fill in are saved.
const EMPLOYEE_GROUPS: CashAmountField[][] = [
  ['openingDrawerCash'],
  ['cashRemoved', 'cashRemaining', 'otherAdjustments'],
];
const ADMIN_GROUPS: CashAmountField[][] = [['openingDrawerCash', 'cashRemoved', 'cashRemaining', 'otherAdjustments']];

const GROUP_TITLES: Record<string, string> = {
  openingDrawerCash: 'Opening drawer cash',
  cashRemoved: 'Cash removed, cash remaining and adjustments',
};

// Shown to Owner/Admin and Super Admin only (employees never see expected cash).
const EXPECTED_CASH_FORMULA =
  "Daily expected cash = Cash remaining ± Other adjustments. Expected Cash on Hand adds up every day's figure. Opening drawer cash and Cash removed are recorded only.";

type Values = Record<CashAmountField, string>;
type Errors = Partial<Record<CashAmountField, string>>;

const EMPTY_VALUES: Values = {
  openingDrawerCash: '',
  cashRemoved: '',
  cashRemaining: '',
  otherAdjustments: '',
};

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Employees can look back at most this many days from today.
const EMPLOYEE_LOOKBACK_DAYS = 7;

function earliestEmployeeKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - EMPLOYEE_LOOKBACK_DAYS);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    const before = correction[`previous${capitalise(field.key)}` as keyof DailyCashCorrection] as number | null;
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
                      {change.label}: {change.before === null ? 'not set' : formatCurrency(change.before)} → {formatCurrency(change.after)}
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

const isBlank = (raw: string) => raw.trim() === '';

// True when the field holds a figure that differs from what is saved.
function fieldChanged(entry: DailyCashEntry, values: Values, key: CashAmountField): boolean {
  if (isBlank(values[key])) return false;
  return parseAmount(values[key]) !== entry[key];
}

// Overwriting a figure that was already recorded is a correction. Filling in
// one that was blank (e.g. the employee's second form after the opening
// drawer) is not. Other adjustments is saved as 0 until someone types one.
function isOverwrite(entry: DailyCashEntry, values: Values, key: CashAmountField): boolean {
  if (!fieldChanged(entry, values, key)) return false;
  const saved = entry[key];
  return saved !== null && !(key === 'otherAdjustments' && saved === 0);
}

function valuesFrom(entry: DailyCashEntry): Values {
  const values = { ...EMPTY_VALUES };
  for (const field of FIELDS) {
    const saved = entry[field.key];
    // Other adjustments shows blank until one is entered.
    values[field.key] = saved === null || (field.key === 'otherAdjustments' && saved === 0) ? '' : formatAmount(saved);
  }
  return values;
}

// Employees must fill every field of a form except the optional one; Owner/Admin
// and Super Admin may leave any of them blank.
function validateField(field: FieldSpec, raw: string, mandatory: boolean): string | undefined {
  if ((field.optional || !mandatory) && isBlank(raw)) return undefined;
  return validateAmount(field.label, raw, { signed: field.signed });
}

function validateGroup(keys: CashAmountField[], values: Values, mandatory: boolean): Errors {
  const errors: Errors = {};
  for (const key of keys) {
    const error = validateField(FIELD_BY_KEY[key], values[key], mandatory);
    if (error) errors[key] = error;
  }
  return errors;
}

// Daily Cash Entry (RTS-292): one form per store + business date, for an
// Owner/Admin's own store or any store a Super Admin picks. Picking a date
// loads whatever was saved for it, so reopening a day pre-fills it for review
// or correction. Changing a saved day is a direct correction: it needs a
// reason, overwrites the entry, and the server keeps who/when/why with the old
// and new values (shown under the form). No one is notified of a correction.
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
  const [savingSection, setSavingSection] = useState<CashAmountField | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [reason, setReason] = useState('');
  const [openingNote, setOpeningNote] = useState('');
  const [otherCashNote, setOtherCashNote] = useState('');
  const [reasonError, setReasonError] = useState<string | undefined>(undefined);
  // Bumped after each successful save so Expected Cash on Hand refetches.
  const [expectedRefreshKey, setExpectedRefreshKey] = useState(0);
  const [showHistory, setShowHistory] = useState(false);
  // Super Admin: Update Entry asks for confirmation before saving, and Flag
  // opens the note popup (CashEntryFlagSection owns the popup itself).
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingKeys, setPendingKeys] = useState<CashAmountField[]>([]);
  const [flagRequest, setFlagRequest] = useState(0);

  // A notification asked for a specific day (the flagged entry's date).
  useEffect(() => {
    if (!dateSeed) return;
    if (dateSeed.date) setBusinessDate(dateSeed.date);
    setReloadToken((token) => token + 1);
  }, [dateSeed]);

  const loadHistory = useCallback(
    (from: string, to: string, status: CashHistoryStatusFilter, signal: AbortSignal) => {
      if (storeId === null) return Promise.reject(new Error('No store selected'));
      if (scope === 'employee') return Promise.reject(new Error('History is not available'));
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
      setErrors((current) => ({ ...current, [field.key]: validateField(field, raw, scope === 'employee') }));
    }
  }

  function handleBlur(field: FieldSpec) {
    const raw = values[field.key];
    if (validateField(field, raw, scope === 'employee')) return;
    if (isBlank(raw)) return;
    setValues((current) => ({ ...current, [field.key]: formatAmount(parseAmount(raw)) }));
  }

  // The form being saved: the keys it holds. A save sends only those amounts
  // that were filled in, so one form never touches the other's figures.
  async function handleSubmit(event: FormEvent, keys: CashAmountField[]) {
    event.preventDefault();
    setSubmitAttempted(true);
    setSaveError(null);
    const nextErrors = validateGroup(keys, values, scope === 'employee');
    const noneFilled = keys.every((key) => isBlank(values[key]));
    if (noneFilled && Object.keys(nextErrors).length === 0) {
      nextErrors[keys[0]] = 'Enter an amount to save';
    }
    // The opening drawer cash comes first: the other amounts can only be saved
    // once it is recorded, or is being saved in the same form.
    const otherFilled = keys.some((key) => key !== 'openingDrawerCash' && !isBlank(values[key]));
    const openingKnown = entry?.openingDrawerCash != null
      || (keys.includes('openingDrawerCash') && !isBlank(values.openingDrawerCash));
    if (otherFilled && !openingKnown && Object.keys(nextErrors).length === 0) {
      nextErrors[keys.includes('openingDrawerCash') ? 'openingDrawerCash' : keys[0]] =
        'Enter the opening drawer cash first';
    }
    // Nothing differs from what is saved: don't send a request. An employee
    // saving a flagged entry may still submit unchanged, as that resolves it.
    if (
      Object.keys(nextErrors).length === 0 && entry !== null
      && !(scope === 'employee' && entry.flag)
      && !keys.some((key) => fieldChanged(entry, values, key))
    ) {
      nextErrors[keys[0]] = 'No changes to save';
    }
    setErrors((current) => ({ ...current, ...Object.fromEntries(keys.map((key) => [key, nextErrors[key]])) }));
    // Overwriting a recorded figure is a correction.
    const isCorrection = entry !== null && Object.keys(nextErrors).length === 0
      && keys.some((key) => isOverwrite(entry, values, key));
    // Employees give an optional note and Super Admins confirm in a popup; only
    // an Owner/Admin must state a reason.
    const nextReasonError = isCorrection && scope === 'owner' && !reason.trim() ? REASON_REQUIRED : undefined;
    setReasonError(nextReasonError);
    if (Object.keys(nextErrors).length > 0 || nextReasonError || storeId === null || isFutureDate(businessDate)) return;
    if (scope === 'super-admin' && isCorrection) {
      setPendingKeys(keys);
      setConfirmOpen(true);
      return;
    }
    await performSave(isCorrection, keys);
  }

  async function performSave(isCorrection: boolean, keys: CashAmountField[]) {
    if (storeId === null) return;
    const note = scope === 'employee'
      ? keys[0] === 'openingDrawerCash' ? openingNote : otherCashNote
      : reason;
    const amounts: Partial<CashAmounts> = {};
    for (const key of keys) {
      if (!isBlank(values[key])) amounts[key] = parseAmount(values[key]);
    }

    setSavingSection(keys[0]);
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
      // Keep what is typed in the other form; refresh only this form's fields.
      setValues((current) => {
        const fresh = valuesFrom(saved);
        const next = { ...current };
        for (const key of keys) next[key] = fresh[key];
        return next;
      });
      setSubmitAttempted(false);
      if (scope === 'employee') {
        if (keys[0] === 'openingDrawerCash') setOpeningNote('');
        else setOtherCashNote('');
      } else {
        setReason('');
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

  const pendingChanges = entry
    ? pendingKeys.filter((key) => fieldChanged(entry, values, key)).map((key) => {
        const saved = entry[key];
        return `${FIELD_BY_KEY[key].label}: ${saved === null ? 'not set' : formatCurrency(saved)} → ${formatCurrency(parseAmount(values[key]))}`;
      })
    : [];
  const dateIsFuture = isFutureDate(businessDate);
  const isEmployee = scope === 'employee';
  const groups = isEmployee ? EMPLOYEE_GROUPS : ADMIN_GROUPS;
  const isSaving = savingSection !== null;
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
                <PopoverDateField id="daily-cash-date" value={businessDate} min={isEmployee ? earliestEmployeeKey() : undefined} max={todayKey()} onChange={(value) => { if (value) setBusinessDate(value); }} />
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
          <CashEntryFlagSection
            entry={entry}
            canManage={scope === 'owner' || scope === 'super-admin'}
            scope={scope === 'super-admin' ? 'super-admin' : 'owner'}
            storeId={storeId}
            hideRaiseButton={scope === 'super-admin'}
            raiseRequest={flagRequest}
            onEntryChange={applyEntry}
          />
        )}

        {readOnly && !loadError && !dateIsFuture && (
          <p className="daily-cash-page__status" role="note">
            {entry
              ? entry.flag
                ? 'This entry was flagged for the employee who entered it. Only they can correct it.'
                : businessDate === todayKey()
                  ? `Submitted by ${entry.enteredByName ?? 'an admin'}. This entry is read-only.`
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
        ) : (
          <div className="daily-cash-page__forms">
            {groups.map((keys, groupIndex) => {
              const isLastGroup = groupIndex === groups.length - 1;
              const hasRecorded = entry !== null && keys.some((key) => entry[key] !== null && !(key === 'otherAdjustments' && entry[key] === 0));
              const showReason = entry !== null && hasRecorded && !readOnly && scope !== 'super-admin';
              const title = isEmployee ? GROUP_TITLES[keys[0]] : undefined;
              const note = isEmployee
                ? keys[0] === 'openingDrawerCash' ? openingNote : otherCashNote
                : reason;
              return (
                <form
                  key={keys[0]}
                  className="daily-cash-page__form"
                  aria-label={title ?? 'Daily cash entry'}
                  onSubmit={(event) => handleSubmit(event, keys)}
                  noValidate
                >
                  {title && <h3 className="daily-cash-page__form-title">{title}</h3>}
                  <fieldset className="daily-cash-page__fieldset" disabled={isLoading || isSaving || readOnly}>
                    <div className="daily-cash-page__grid">
                      {keys.map((key) => {
                        const field = FIELD_BY_KEY[key];
                        const id = `daily-cash-${field.key}`;
                        const error = errors[field.key];
                        return (
                          <FormField
                            key={field.key}
                            label={field.label}
                            htmlFor={id}
                            description={field.description}
                            required={isEmployee && !field.optional}
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

                    {showReason && (
                      <div className="daily-cash-page__reason">
                        <FormField
                          label={isEmployee ? 'Note (optional)' : 'Reason for correction'}
                          htmlFor={`daily-cash-correction-reason-${groupIndex}`}
                          description={isEmployee
                            ? (entry?.flag
                              ? 'Add a note for the admin about what you fixed. Saving resolves the flag.'
                              : "Add a note about this change if you like. It's kept with the entry's history.")
                            : "Required if you change a figure that is already saved. Kept with the entry's history."}
                          error={reasonError}
                        >
                          <textarea
                            id={`daily-cash-correction-reason-${groupIndex}`}
                            className="input daily-cash-page__reason-input"
                            rows={2}
                            maxLength={REASON_MAX}
                            value={note}
                            aria-invalid={reasonError ? true : undefined}
                            onChange={(event) => {
                              if (isEmployee) {
                                if (keys[0] === 'openingDrawerCash') setOpeningNote(event.target.value);
                                else setOtherCashNote(event.target.value);
                              } else {
                                setReason(event.target.value);
                              }
                              if (reasonError && event.target.value.trim()) setReasonError(undefined);
                            }}
                          />
                        </FormField>
                      </div>
                    )}
                  </fieldset>

                  <div className="daily-cash-page__actions">
                    {keys.some((key) => errors[key]) && (
                      <span className="daily-cash-page__error-summary">
                        Fix {keys.filter((key) => errors[key]).length === 1 ? 'the highlighted field' : 'the highlighted fields'} to save.
                      </span>
                    )}
                    {!readOnly && (
                      <button type="submit" className="btn btn--primary" disabled={isLoading || isSaving || dateIsFuture}>
                        {savingSection === keys[0]
                          ? <ButtonDots label="Saving" />
                          : entry?.flag && isEmployee ? 'Save & resolve flag' : hasRecorded ? 'Update Entry' : 'Save Entry'}
                      </button>
                    )}
                    {isLastGroup && scope === 'super-admin' && entry && !entry.flag && (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        disabled={isLoading || isSaving || dateIsFuture}
                        onClick={() => setFlagRequest((count) => count + 1)}
                      >
                        Flag
                      </button>
                    )}
                    {isLastGroup && !isEmployee && (
                      <button type="button" className="btn btn--secondary" onClick={() => setShowHistory((open) => !open)}>
                        {showHistory ? 'Hide history' : 'View history'}
                      </button>
                    )}
                  </div>
                </form>
              );
            })}
            {saveError && (
              <p className="daily-cash-page__alert" role="alert">{saveError}</p>
            )}
            {entry && !isEmployee && <CorrectionHistory history={entry.history} />}
            {showHistory && !isEmployee && (
              <CashHistoryPanel load={loadHistory} reloadKey={`${storeId}-${expectedRefreshKey}`} />
            )}
          </div>
        )}
      </section>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Update cash entry"
        message={`Update the cash entry for ${formatDateLabel(businessDate)}? The previous figures are kept in the entry's history.`}
        details={pendingChanges}
        confirmLabel="Update"
        danger={false}
        onConfirm={async () => {
          setConfirmOpen(false);
          await performSave(true, pendingKeys);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default DailyCash;
