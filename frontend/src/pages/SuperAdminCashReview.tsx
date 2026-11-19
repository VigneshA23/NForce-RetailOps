import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { ApiError } from '../api/client';
import { getSuperAdminCashHistory } from '../api/storeCash';
import CashHistoryPanel from '../components/CashHistoryPanel';
import type { CashHistoryStatusFilter } from '../types/storeCash';
import { getAllStores } from '../api/superAdminStores';
import {
  correctSuperAdminCashEntry,
  editSuperAdminCashFlag,
  getSuperAdminCashReview,
  raiseSuperAdminCashFlag,
  removeSuperAdminCashFlag,
} from '../api/superAdminCashReview';
import type { SuperAdminStore } from '../types/superAdminStore';
import type {
  CashEntryStatus,
  SuperAdminCashReview,
  SuperAdminCashReviewFlag,
  SuperAdminCashReviewEntry,
} from '../types/superAdminCashReview';
import FormField from '../components/FormField';
import SearchableSelect from '../components/SearchableSelect';
import PopoverDateField from '../components/PopoverDateField';
import Modal from '../components/Modal';
import ButtonDots from '../components/ButtonDots';
import ConfirmDialog from '../components/ConfirmDialog';
import { formatCurrency } from '../utils/currency';
import { parseAmount, validateAmount } from '../utils/amountInput';
import { usePersistedState, nullableNumber } from '../hooks/usePersistedState';
import { nfToast } from '../utils/toast';
import './SuperAdminCashReview.css';

// The review fields, in the spec order (Other adjustments is optional, blank = 0).
// The entry still holds total
// cash sales and bank deposits -- they're kept on the model but not shown
// in the review view.
const REVIEW_FIELDS = [
  { key: 'openingDrawerCash', label: 'Opening drawer cash', signed: false, optional: false },
  { key: 'cashRemoved', label: 'Cash removed', signed: false, optional: false },
  { key: 'cashRemaining', label: 'Cash remaining', signed: false, optional: false },
  { key: 'otherAdjustments', label: 'Other adjustments', signed: true, optional: true },
] as const;

type ReviewFieldKey = (typeof REVIEW_FIELDS)[number]['key'];
type CorrectionValues = Record<ReviewFieldKey, string>;
type CorrectionErrors = Partial<Record<ReviewFieldKey | 'reason', string>>;

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatMoneyString(raw: string): string {
  const n = Number(raw);
  return Number.isFinite(n) ? formatCurrency(n) : raw;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function statusPillClass(status: CashEntryStatus): string {
  return `cash-review__status-pill cash-review__status-pill--${status.toLowerCase()}`;
}

function entryToCorrectionValues(entry: SuperAdminCashReviewEntry): CorrectionValues {
  return {
    openingDrawerCash: entry.openingDrawerCash,
    cashRemoved: entry.cashRemoved,
    cashRemaining: entry.cashRemaining,
    otherAdjustments: entry.otherAdjustments,
  };
}

function SuperAdminCashReview() {
  // Store picker (same persistence pattern as the existing SuperAdminCash tab)
  const [stores, setStores] = useState<SuperAdminStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = usePersistedState<number | null>(
    'sa-cash-review-store', null, nullableNumber,
  );
  const [storesReloadToken, setStoresReloadToken] = useState(0);
  const reloadStores = useCallback(() => setStoresReloadToken((n) => n + 1), []);

  // Date and the review payload itself
  const [businessDate, setBusinessDate] = useState<string>(todayKey);
  const [review, setReview] = useState<SuperAdminCashReview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // Correction modal
  const [isCorrectOpen, setCorrectOpen] = useState(false);
  const [correctValues, setCorrectValues] = useState<CorrectionValues | null>(null);
  const [correctReason, setCorrectReason] = useState('');
  const [correctErrors, setCorrectErrors] = useState<CorrectionErrors>({});
  const [correctSubmitting, setCorrectSubmitting] = useState(false);
  const [correctSubmitError, setCorrectSubmitError] = useState<string | null>(null);

  // Flag modal (used for both raise and edit)
  const [flagMode, setFlagMode] = useState<'raise' | 'edit' | null>(null);
  const [flagComment, setFlagComment] = useState('');
  const [flagError, setFlagError] = useState<string | null>(null);
  const [flagSubmitting, setFlagSubmitting] = useState(false);
  const [removeFlagOpen, setRemoveFlagOpen] = useState(false);
  const [removingFlag, setRemovingFlag] = useState(false);

  // Load stores (filter to active; a stale remembered id falls back to null)
  useEffect(() => {
    let active = true;
    setStoresLoading(true);
    setStoresError(null);
    getAllStores()
      .then((data) => { if (active) setStores(data.filter((s) => s.storeActive)); })
      .catch((cause: unknown) => {
        if (active) setStoresError(cause instanceof Error ? cause.message : 'Could not load stores');
      })
      .finally(() => { if (active) setStoresLoading(false); });
    return () => { active = false; };
  }, [storesReloadToken]);

  const storeId = !storesLoading && stores.some((s) => s.storeId === selectedStoreId)
    ? selectedStoreId
    : null;

  const loadHistory = useCallback(
    (from: string, to: string, status: CashHistoryStatusFilter, signal: AbortSignal) =>
      storeId === null
        ? Promise.reject(new Error('No store selected'))
        : getSuperAdminCashHistory(storeId, from, to, status, signal),
    [storeId],
  );

  // Switching stores clears the previous store's review data immediately so
  // none of its figures stay on screen while the new one loads (acceptance
  // criteria: "Switching stores").
  useEffect(() => {
    setReview(null);
    setLoadError(null);
  }, [storeId]);

  // Load the review for the current (store, date)
  useEffect(() => {
    if (storeId === null) return;
    const controller = new AbortController();
    setIsLoading(true);
    setLoadError(null);
    getSuperAdminCashReview(storeId, businessDate, controller.signal)
      .then((data) => setReview(data))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setReview(null);
        setLoadError(cause instanceof Error ? cause.message : 'Could not load cash entry.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [storeId, businessDate, reloadToken]);

  const storeOptions = useMemo(
    () => stores.map((s) => ({ id: s.storeId, label: s.storeName, sublabel: `#${s.storeCode}` })),
    [stores],
  );

  // ---- Correction modal ----

  function openCorrectModal() {
    if (!review?.entry) return;
    setCorrectValues(entryToCorrectionValues(review.entry));
    setCorrectReason('');
    setCorrectErrors({});
    setCorrectSubmitError(null);
    setCorrectOpen(true);
  }

  function closeCorrectModal() {
    setCorrectOpen(false);
    setCorrectValues(null);
  }

  function handleCorrectField(key: ReviewFieldKey, raw: string) {
    setCorrectValues((current) => (current ? { ...current, [key]: raw } : current));
    if (correctErrors[key]) {
      const field = REVIEW_FIELDS.find((f) => f.key === key)!;
      setCorrectErrors((err) => ({
        ...err,
        [key]: field.optional && raw.trim() === '' ? undefined : validateAmount(field.label, raw, { signed: field.signed }),
      }));
    }
  }

  async function submitCorrection(event: FormEvent) {
    event.preventDefault();
    if (!review?.entry || !correctValues || storeId === null) return;
    const errors: CorrectionErrors = {};
    for (const field of REVIEW_FIELDS) {
      const msg = field.optional && correctValues[field.key].trim() === '' ? undefined : validateAmount(field.label, correctValues[field.key], { signed: field.signed });
      if (msg) errors[field.key] = msg;
    }
    const reason = correctReason.trim();
    if (reason.length < 5) errors.reason = 'A reason of at least 5 characters is required.';
    setCorrectErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setCorrectSubmitting(true);
    setCorrectSubmitError(null);
    try {
      const refreshed = await correctSuperAdminCashEntry(storeId, review.entry.id, {
        openingDrawerCash: parseAmount(correctValues.openingDrawerCash),
        cashRemoved: parseAmount(correctValues.cashRemoved),
        cashRemaining: parseAmount(correctValues.cashRemaining),
        otherAdjustments: parseAmount(correctValues.otherAdjustments),
        reason,
      });
      setReview(refreshed);
      closeCorrectModal();
      nfToast.success('Cash entry corrected.');
    } catch (cause) {
      const fieldErrors = cause instanceof ApiError ? cause.fieldErrors : undefined;
      if (fieldErrors) {
        const next: CorrectionErrors = {};
        for (const [key, msg] of Object.entries(fieldErrors)) {
          if (REVIEW_FIELDS.some((f) => f.key === (key as ReviewFieldKey)) || key === 'reason') {
            next[key as keyof CorrectionErrors] = msg;
          }
        }
        setCorrectErrors(next);
      }
      setCorrectSubmitError(cause instanceof Error ? cause.message : 'Could not save correction.');
    } finally {
      setCorrectSubmitting(false);
    }
  }

  // ---- Flag modal ----

  function openFlagModal(mode: 'raise' | 'edit', currentFlag?: SuperAdminCashReviewFlag | null) {
    setFlagMode(mode);
    setFlagComment(mode === 'edit' ? currentFlag?.comment ?? '' : '');
    setFlagError(null);
  }

  function closeFlagModal() {
    setFlagMode(null);
    setFlagComment('');
    setFlagError(null);
  }

  async function submitFlag(event: FormEvent) {
    event.preventDefault();
    if (!review?.entry || storeId === null || flagMode === null) return;
    const trimmed = flagComment.trim();
    if (trimmed.split(/\s+/).filter(Boolean).length < 5) {
      setFlagError('Please give at least 5 words of context.');
      return;
    }
    setFlagSubmitting(true);
    setFlagError(null);
    try {
      const refreshed = flagMode === 'raise'
        ? await raiseSuperAdminCashFlag(storeId, review.entry.id, { comment: trimmed })
        : await editSuperAdminCashFlag(storeId, review.entry.id, { comment: trimmed });
      setReview(refreshed);
      closeFlagModal();
      nfToast.success(flagMode === 'raise' ? 'Entry flagged and employee notified.' : 'Flag comment updated.');
    } catch (cause) {
      setFlagError(cause instanceof Error ? cause.message : 'Could not update flag.');
    } finally {
      setFlagSubmitting(false);
    }
  }

  async function confirmRemoveFlag() {
    if (!review?.entry || storeId === null) return;
    setRemovingFlag(true);
    try {
      const refreshed = await removeSuperAdminCashFlag(storeId, review.entry.id);
      setReview(refreshed);
      setRemoveFlagOpen(false);
      nfToast.success('Flag removed.');
    } catch (cause) {
      nfToast.error(cause instanceof Error ? cause.message : 'Could not remove flag.');
    } finally {
      setRemovingFlag(false);
    }
  }

  // ---- render ----

  return (
    <div className="cash-review">
      <section className="cash-review__entry-card">
        <div className="cash-review__pickers">
          <FormField label="Store" htmlFor="cash-review-store">
            <SearchableSelect
              id="cash-review-store"
              options={storeOptions}
              selectedIds={storeId === null ? [] : [storeId]}
              onChange={(ids) => setSelectedStoreId(ids[0] ?? null)}
              placeholder="Select a store…"
              isLoading={storesLoading}
              error={storesError}
              onRetry={reloadStores}
              emptyMessage="No stores found"
            />
          </FormField>
          <FormField label="Date" htmlFor="cash-review-date">
            <PopoverDateField
              id="cash-review-date"
              value={businessDate}
              max={todayKey()}
              onChange={(value) => { if (value) setBusinessDate(value); }}
            />
          </FormField>
        </div>
      </section>

      {storeId === null ? (
        <section className="cash-review__empty-card">
          <p className="cash-review__status">
            {storesLoading ? 'Loading stores…' : 'Select a store to review its cash entries.'}
          </p>
        </section>
      ) : loadError ? (
        <section className="cash-review__empty-card">
          <p className="cash-review__error">{loadError}</p>
          <button type="button" className="btn btn--secondary" onClick={() => setReloadToken((n) => n + 1)}>
            Retry
          </button>
        </section>
      ) : isLoading || !review ? (
        <section className="cash-review__empty-card">
          <p className="cash-review__status">Loading…</p>
        </section>
      ) : (
        <>
          <section className="cash-review__stats">
            <div className="cash-review__stat">
              <p className="cash-review__stat-label">Cash target (read-only)</p>
              <p className="cash-review__stat-value">{formatMoneyString(review.cashTarget)}</p>
            </div>
            <div className="cash-review__stat">
              <p className="cash-review__stat-label">Expected cash on hand</p>
              <p className="cash-review__stat-value">{formatMoneyString(review.expectedCashOnHand)}</p>
            </div>
          </section>

          {review.entry === null ? (
            <section className="cash-review__empty-card">
              <p className="cash-review__status">
                No cash entry for {review.storeName} on {businessDate}. The cash target and
                expected cash on hand up to this date are shown above.
              </p>
            </section>
          ) : (
            <>
              <section className="cash-review__entry-card">
                <div className="cash-review__section-header">
                  <h3 className="cash-review__section-title">Cash entry</h3>
                  <span className={statusPillClass(review.entry.status)}>{review.entry.status}</span>
                </div>
                <div className="cash-review__field-grid">
                  {REVIEW_FIELDS.map((field) => (
                    <div key={field.key}>
                      <p className="cash-review__field-label">{field.label}</p>
                      <p className="cash-review__field-value">
                        {formatMoneyString(review.entry![field.key])}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="cash-review__meta">
                  <span>
                    Entered by {review.entry.enteredBy?.name ?? 'unknown'} on {formatDateTime(review.entry.enteredAt)}
                  </span>
                  {review.entry.status === 'Corrected' && review.entry.updatedBy && (
                    <span>
                      Corrected by {review.entry.updatedBy.name} on {formatDateTime(review.entry.updatedAt)}
                    </span>
                  )}
                </div>
                <div className="cash-review__actions" style={{ marginTop: '1rem' }}>
                  <button type="button" className="btn btn--primary" onClick={openCorrectModal}>
                    Correct entry
                  </button>
                  {review.flag === null && (
                    <button type="button" className="btn btn--secondary" onClick={() => openFlagModal('raise')}>
                      Flag entry
                    </button>
                  )}
                </div>
              </section>

              {review.flag && (
                <section className="cash-review__flag-card">
                  <div className="cash-review__section-header">
                    <h3 className="cash-review__section-title">Flagged</h3>
                    <span className={statusPillClass('Flagged')}>Open</span>
                  </div>
                  <p className="cash-review__flag-comment">&ldquo;{review.flag.comment}&rdquo;</p>
                  <p className="cash-review__status">
                    Flagged by {review.flag.flaggedBy?.name ?? 'unknown'} on {formatDateTime(review.flag.flaggedAt)}
                    {review.flag.commentUpdatedAt && (
                      <> · comment edited {formatDateTime(review.flag.commentUpdatedAt)}</>
                    )}
                  </p>
                  <div className="cash-review__actions" style={{ marginTop: '0.75rem' }}>
                    <button type="button" className="btn btn--secondary" onClick={() => openFlagModal('edit', review.flag)}>
                      Edit comment
                    </button>
                    <button type="button" className="btn btn--secondary" onClick={() => setRemoveFlagOpen(true)}>
                      Remove flag
                    </button>
                  </div>
                </section>
              )}

              {review.history.length > 0 && (
                <section className="cash-review__history-card">
                  <h3 className="cash-review__section-title">Correction history</h3>
                  <ul className="cash-review__history-list">
                    {review.history.map((entry) => (
                      <li key={entry.id} className="cash-review__history-item">
                        <p className="cash-review__history-meta">
                          {entry.correctedBy
                            ? `Corrected by ${entry.correctedBy.name}`
                            : 'Corrected'} on {formatDateTime(entry.correctedAt)}
                        </p>
                        <div className="cash-review__field-grid">
                          <PrevField label="Opening drawer cash" value={entry.previousOpeningDrawerCash} />
                          <PrevField label="Cash removed" value={entry.previousCashRemoved} />
                          <PrevField label="Cash remaining" value={entry.previousCashRemaining} />
                          <PrevField label="Other adjustments" value={entry.previousOtherAdjustments} />
                        </div>
                        {entry.reason && (
                          <p className="cash-review__reason">Reason: {entry.reason}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}

      {storeId !== null && (
        <section className="cash-review__history-card">
          <CashHistoryPanel
            load={loadHistory}
            reloadKey={`${storeId}-${review?.entry?.id ?? 'none'}-${review?.entry?.updatedAt ?? ''}-${review?.flag?.id ?? ''}-${review?.flag?.commentUpdatedAt ?? ''}`}
          />
        </section>
      )}

      {/* Correct modal */}
      <Modal
        isOpen={isCorrectOpen}
        onClose={closeCorrectModal}
        title="Correct cash entry"
        size="lg"
        centered
      >
        {correctValues && (
          <form onSubmit={submitCorrection} noValidate>
            <div className="cash-review__form-grid">
              {REVIEW_FIELDS.map((field) => (
                <FormField
                  key={field.key}
                  label={field.label}
                  htmlFor={`correct-${field.key}`}
                  error={correctErrors[field.key]}
                  required={!field.optional}
                >
                  <div className="cash-review__money-input">
                    <span aria-hidden>$</span>
                    <input
                      id={`correct-${field.key}`}
                      className="input"
                      type="text"
                      inputMode="decimal"
                      value={correctValues[field.key]}
                      onChange={(e) => handleCorrectField(field.key, e.target.value)}
                    />
                  </div>
                </FormField>
              ))}
            </div>
            <FormField
              label="Reason for correction"
              htmlFor="correct-reason"
              error={correctErrors.reason}
              required
            >
              <textarea
                id="correct-reason"
                className="cash-review__textarea"
                value={correctReason}
                onChange={(e) => setCorrectReason(e.target.value)}
                placeholder="Why is this correction being made?"
              />
            </FormField>
            {correctSubmitError && <p className="cash-review__error">{correctSubmitError}</p>}
            <div className="cash-review__actions" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
              <button type="button" className="btn btn--secondary" onClick={closeCorrectModal} disabled={correctSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn--primary" disabled={correctSubmitting}>
                {correctSubmitting ? <ButtonDots label="Saving" /> : 'Save correction'}
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* Flag modal: both raise and edit */}
      <Modal
        isOpen={flagMode !== null}
        onClose={closeFlagModal}
        title={flagMode === 'edit' ? 'Edit flag comment' : 'Flag cash entry'}
        subtitle={
          flagMode === 'raise'
            ? 'The employee who entered this will be notified with your comment. Use at least five words.'
            : undefined
        }
        centered
      >
        <form onSubmit={submitFlag} noValidate>
          <FormField
            label="Flag comment"
            htmlFor="flag-comment"
            error={flagError ?? undefined}
            required
          >
            <textarea
              id="flag-comment"
              className="cash-review__textarea"
              value={flagComment}
              onChange={(e) => setFlagComment(e.target.value)}
              placeholder="Describe what looks off."
            />
          </FormField>
          <div className="cash-review__actions" style={{ marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn--secondary" onClick={closeFlagModal} disabled={flagSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn--primary" disabled={flagSubmitting}>
              {flagSubmitting ? <ButtonDots label="Saving" /> : flagMode === 'edit' ? 'Save' : 'Flag entry'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={removeFlagOpen}
        title="Remove flag"
        message="Remove the flag from this cash entry? The flag history is kept for audit."
        confirmLabel={removingFlag ? 'Removing…' : 'Remove'}
        onConfirm={confirmRemoveFlag}
        onCancel={() => setRemoveFlagOpen(false)}
      />
    </div>
  );
}

function PrevField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="cash-review__field-label">{label}</p>
      <p className="cash-review__field-value">{formatMoneyString(value)}</p>
    </div>
  );
}

export default SuperAdminCashReview;
