import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { getCashTarget, getSuperAdminCashTarget, saveCashTarget, saveSuperAdminCashTarget } from '../api/storeCashTarget';
import { isDefaultTarget, type StoreCashTarget } from '../types/storeCashTarget';
import FormField from './FormField';
import ButtonDots from './ButtonDots';
import { formatAmount, formatCurrency } from '../utils/currency';
import { parseAmount, validateAmount } from '../utils/amountInput';
import { nfToast } from '../utils/toast';
import './CashTargetForm.css';

type CashTargetFormProps =
  // Owner/Admin: the server resolves their own store.
  | { scope: 'owner'; storeId?: undefined }
  // Super Admin: the store is sent explicitly.
  | { scope: 'super-admin'; storeId: number };

const LABEL = 'Target amount';

function formatChangedAt(value: string): string {
  return new Date(value).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

// View and change one store's cash-drawer target (RTS-294). The current value
// is shown on its own, apart from the input, so a failed save visibly leaves
// the old target in effect; it only changes once the server confirms.
function CashTargetForm(props: CashTargetFormProps) {
  const { scope, storeId } = props;
  const [target, setTarget] = useState<StoreCashTarget | null>(null);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    setSaveError(null);
    setError(undefined);
    setSubmitAttempted(false);

    const request = scope === 'super-admin'
      ? getSuperAdminCashTarget(storeId, controller.signal)
      : getCashTarget(controller.signal);
    request
      .then((result) => {
        setTarget(result);
        setValue(formatAmount(result.targetAmount));
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setTarget(null);
        setLoadError(cause instanceof Error ? cause.message : 'Could not load the cash target.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });

    return () => controller.abort();
  }, [scope, storeId, reloadToken]);

  function handleChange(raw: string) {
    setValue(raw);
    if (submitAttempted) setError(validateAmount(LABEL, raw));
  }

  function handleBlur() {
    if (!validateAmount(LABEL, value)) setValue(formatAmount(parseAmount(value)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!target) return;
    setSubmitAttempted(true);
    setSaveError(null);
    const nextError = validateAmount(LABEL, value);
    setError(nextError);
    if (nextError) return;

    const amount = parseAmount(value);
    if (amount === target.targetAmount) {
      nfToast.info(`The target is already ${formatCurrency(amount)}.`);
      return;
    }

    setIsSaving(true);
    try {
      const saved = scope === 'super-admin'
        ? await saveSuperAdminCashTarget(storeId, amount)
        : await saveCashTarget(amount);
      setTarget(saved);
      setValue(formatAmount(saved.targetAmount));
      setSubmitAttempted(false);
      nfToast.success(`Cash drawer target set to ${formatCurrency(saved.targetAmount)}.`);
    } catch (cause) {
      const fieldMessage = cause instanceof ApiError ? cause.fieldErrors?.targetAmount : undefined;
      if (fieldMessage) setError(fieldMessage);
      const message = fieldMessage ?? (cause instanceof Error ? cause.message : 'Could not save the cash target.');
      setSaveError(`Not saved: ${message} The target is still ${formatCurrency(target.targetAmount)}.`);
      nfToast.error('Cash drawer target was not saved. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <p className="cash-target-form__status">Loading the current target…</p>;
  }

  if (loadError || !target) {
    return (
      <div className="cash-target-form__alert" role="alert">
        <span>{loadError ?? 'Could not load the cash target.'}</span>
        <button type="button" className="btn btn--secondary" onClick={() => setReloadToken((token) => token + 1)}>
          Retry
        </button>
      </div>
    );
  }

  const isDefault = isDefaultTarget(target);

  return (
    <div className="cash-target-form">
      <div className="cash-target-form__current" aria-live="polite">
        <span className="cash-target-form__current-label">Current target</span>
        <span className="cash-target-form__current-value">
          <span data-testid="cash-target-current">{formatCurrency(target.targetAmount)}</span>
          {isDefault && <span className="badge badge--outline cash-target-form__default">Default</span>}
        </span>
        <span className="cash-target-form__current-meta">
          {isDefault ? 'This store has not set its own target yet.' : `Last changed ${formatChangedAt(target.updatedAt)}`}
        </span>
      </div>

      <form className="cash-target-form__form" onSubmit={handleSubmit} noValidate>
        <FormField label="New target amount" htmlFor={`cash-target-input-${storeId ?? 'own'}`} required error={error}>
          <div className="cash-target-form__row">
            <div className="cash-target-form__money">
              <span className="cash-target-form__currency" aria-hidden="true">$</span>
              <input
                id={`cash-target-input-${storeId ?? 'own'}`}
                className="input cash-target-form__input"
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={value}
                disabled={isSaving}
                aria-invalid={error ? true : undefined}
                onChange={(event) => handleChange(event.target.value)}
                onBlur={handleBlur}
              />
            </div>
            <button type="submit" className="btn btn--primary" disabled={isSaving}>
              {isSaving ? <ButtonDots label="Saving" /> : 'Save Target'}
            </button>
          </div>
        </FormField>
        {saveError && <p className="cash-target-form__alert" role="alert">{saveError}</p>}
      </form>
    </div>
  );
}

export default CashTargetForm;
