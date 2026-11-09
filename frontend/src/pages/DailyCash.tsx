import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import {
  getDailyCashEntry,
  getSuperAdminDailyCashEntry,
  saveDailyCashEntry,
  saveSuperAdminDailyCashEntry,
} from '../api/storeCash';
import { ApiError } from '../api/client';
import type { CashAmountField, CashAmounts, DailyCashEntry, DailyCashEntryRequest } from '../types/storeCash';
import FormField from '../components/FormField';
import PopoverDateField from '../components/PopoverDateField';
import ButtonDots from '../components/ButtonDots';
import { formatAmount } from '../utils/currency';
import { nfToast } from '../utils/toast';
import './DailyCash.css';

interface DailyCashProps {
  // Null while stores load, when an Owner/Admin has none, or before a Super
  // Admin has picked one.
  storeId: number | null;
  storesLoading: boolean;
  // 'owner': the server resolves the caller's own store (storeId is only used
  // to know one exists). 'super-admin': storeId is sent explicitly.
  scope?: 'owner' | 'super-admin';
  // Super Admin's store picker, shown beside the date.
  storeSelector?: ReactNode;
  // Shown in place of the form when storeId is null and stores have loaded.
  noStoreMessage?: string;
}

function loadEntry(scope: 'owner' | 'super-admin', storeId: number, date: string, signal: AbortSignal) {
  return scope === 'super-admin'
    ? getSuperAdminDailyCashEntry(storeId, date, signal)
    : getDailyCashEntry(date, signal);
}

function saveEntry(scope: 'owner' | 'super-admin', storeId: number, request: DailyCashEntryRequest) {
  return scope === 'super-admin'
    ? saveSuperAdminDailyCashEntry(storeId, request)
    : saveDailyCashEntry(request);
}

interface FieldSpec {
  key: CashAmountField;
  label: string;
  // Only Other Adjustments may go below zero (money taken out of the drawer
  // for a reason none of the other fields cover), matching RTS-291.
  signed?: boolean;
  hint?: string;
}

const FIELDS: FieldSpec[] = [
  { key: 'totalCashSales', label: 'Total cash sales' },
  { key: 'openingDrawerCash', label: 'Opening drawer cash' },
  { key: 'cashRemoved', label: 'Cash removed' },
  { key: 'cashRemaining', label: 'Cash remaining' },
  { key: 'cashExpenses', label: 'Cash expenses' },
  { key: 'bankDeposits', label: 'Bank deposits' },
  { key: 'otherAdjustments', label: 'Other adjustments', signed: true, hint: 'Use a minus sign for money taken out. Enter 0 if none.' },
];

type Values = Record<CashAmountField, string>;
type Errors = Partial<Record<CashAmountField, string>>;

const EMPTY_VALUES: Values = {
  totalCashSales: '',
  openingDrawerCash: '',
  cashRemoved: '',
  cashRemaining: '',
  cashExpenses: '',
  bankDeposits: '',
  otherAdjustments: '',
};

// The server stores up to 10 whole digits and 2 decimals per amount.
const AMOUNT_PATTERN = /^-?(\d{1,10}(\.\d{0,2})?|\.\d{1,2})$/;
const NUMBER_PATTERN = /^-?(\d+(\.\d*)?|\.\d+)$/;

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDateLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSavedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

function valuesFrom(entry: DailyCashEntry): Values {
  const values = { ...EMPTY_VALUES };
  for (const field of FIELDS) values[field.key] = formatAmount(entry[field.key]);
  return values;
}

// Commas are display-only (formatAmount adds them on blur), so ignore them.
function normalise(raw: string): string {
  return raw.trim().replace(/,/g, '');
}

function validateField(field: FieldSpec, raw: string): string | undefined {
  const value = normalise(raw);
  if (value === '') {
    return field.signed ? `${field.label} is required (enter 0 if none)` : `${field.label} is required`;
  }
  if (!NUMBER_PATTERN.test(value)) return `${field.label} must be a number, e.g. 125.50`;
  if (!field.signed && value.startsWith('-')) return `${field.label} cannot be negative`;
  if (!AMOUNT_PATTERN.test(value)) {
    const [whole = '', fraction = ''] = value.replace('-', '').split('.');
    return fraction.length > 2 ? 'Use at most 2 decimal places' : whole.length > 10 ? 'Amount is too large' : `${field.label} must be a number, e.g. 125.50`;
  }
  return undefined;
}

function validateAll(values: Values): Errors {
  const errors: Errors = {};
  for (const field of FIELDS) {
    const error = validateField(field, values[field.key]);
    if (error) errors[field.key] = error;
  }
  return errors;
}

// Daily Cash Entry (RTS-292): one form per store + business date, for an
// Owner/Admin's own store or any store a Super Admin picks. Picking a date
// loads whatever was saved for it, so reopening a day pre-fills it for review
// or correction; saving again overwrites the entry and the server keeps the
// old values as history.
function DailyCash({
  storeId,
  storesLoading,
  scope = 'owner',
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
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (storeId === null || !businessDate) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setErrors({});
    setSubmitAttempted(false);

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
    setValues((current) => ({ ...current, [field.key]: formatAmount(Number(normalise(raw))) }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitAttempted(true);
    setSaveError(null);
    const nextErrors = validateAll(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || storeId === null) return;

    const amounts = {} as CashAmounts;
    for (const field of FIELDS) amounts[field.key] = Number(normalise(values[field.key]));

    setIsSaving(true);
    try {
      const saved = await saveEntry(scope, storeId, { businessDate, ...amounts });
      setEntry(saved);
      setValues(valuesFrom(saved));
      setSubmitAttempted(false);
      nfToast.success(`Cash entry for ${formatDateLabel(businessDate)} saved.`);
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
      setIsSaving(false);
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

  const errorCount = Object.values(errors).filter(Boolean).length;

  return (
    <div className="daily-cash-page">
      <section className="card daily-cash-page__card" aria-label="Daily cash entry">
        <div className="daily-cash-page__toolbar">
          <div className="daily-cash-page__pickers">
            {storeSelector && <div className="daily-cash-page__store">{storeSelector}</div>}
            <div className="daily-cash-page__date">
              <FormField label="Business date" htmlFor="daily-cash-date">
                <PopoverDateField id="daily-cash-date" value={businessDate} max={todayKey()} onChange={(value) => { if (value) setBusinessDate(value); }} />
              </FormField>
            </div>
          </div>
          {storeId !== null && (
            <p className="daily-cash-page__status" aria-live="polite">
              {isLoading
                ? 'Loading…'
                : loadError
                  ? null
                  : entry
                    ? `Saved · last updated ${formatSavedAt(entry.updatedAt)}`
                    : 'No entry saved for this date yet'}
            </p>
          )}
        </div>

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
          <form className="daily-cash-page__form" onSubmit={handleSubmit} noValidate>
            <fieldset className="daily-cash-page__fieldset" disabled={isLoading || isSaving}>
              <div className="daily-cash-page__grid">
                {FIELDS.map((field) => {
                  const id = `daily-cash-${field.key}`;
                  const error = errors[field.key];
                  return (
                    <FormField key={field.key} label={field.label} htmlFor={id} required error={error}>
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
              <button type="submit" className="btn btn--primary" disabled={isLoading || isSaving}>
                {isSaving ? <ButtonDots label="Saving" /> : entry ? 'Update Entry' : 'Save Entry'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

export default DailyCash;
