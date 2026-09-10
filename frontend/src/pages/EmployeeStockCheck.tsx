import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { getTodayStockCheck, reportAdHocShortage, submitStockCheck } from '../api/stockChecks';
import type { DailyStockCheckItem } from '../types/stockCheck';
import type { StoreSummary } from '../types/store';
import AdHocShortageModal, { type AdHocShortageValues } from '../components/AdHocShortageModal';
import './EmployeeStockCheck.css';

interface EmployeeStockCheckProps {
  store: StoreSummary;
}

function quantityNeededFor(item: DailyStockCheckItem, currentCountText: string): number | null {
  if (item.minTarget == null) return null;
  const count = Number(currentCountText);
  if (currentCountText.trim() === '' || Number.isNaN(count)) return null;
  return Math.max(0, item.minTarget - count);
}

function EmployeeStockCheck({ store }: EmployeeStockCheckProps) {
  const [items, setItems] = useState<DailyStockCheckItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [isAdHocOpen, setIsAdHocOpen] = useState(false);
  const [adHocError, setAdHocError] = useState<string | null>(null);
  const [isAdHocSubmitting, setIsAdHocSubmitting] = useState(false);

  function load() {
    setIsLoading(true);
    setLoadError(null);
    getTodayStockCheck(store.id)
      .then(setItems)
      .catch((error: Error) => setLoadError(error.message))
      .finally(() => setIsLoading(false));
  }

  useEffect(() => {
    load();
  }, [store.id]);

  async function handleSubmitCount(item: DailyStockCheckItem) {
    const draft = drafts[item.storeInventoryItemId];
    if (draft == null || draft.trim() === '') return;
    const count = Number(draft);
    if (Number.isNaN(count) || count < 0) return;
    if (pendingId != null) return;

    setPendingId(item.storeInventoryItemId);
    try {
      await submitStockCheck(store.id, item.storeInventoryItemId, count);
      setItems((current) =>
        current.map((i) =>
          i.storeInventoryItemId === item.storeInventoryItemId
            ? { ...i, currentCount: count, quantityNeeded: quantityNeededFor(item, draft), checkedToday: true }
            : i,
        ),
      );
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.storeInventoryItemId];
        return next;
      });
      nfToast.success(`${item.itemName} count saved.`);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Failed to save count');
    } finally {
      setPendingId(null);
    }
  }

  async function handleAdHocSubmit(values: AdHocShortageValues) {
    setAdHocError(null);
    setIsAdHocSubmitting(true);
    try {
      await reportAdHocShortage(store.id, values.storeInventoryItemId, Number(values.quantity), values.note);
      nfToast.success('Shortage reported to your owner.');
      setIsAdHocOpen(false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to report shortage';
      setAdHocError(msg);
      nfToast.error(msg);
    } finally {
      setIsAdHocSubmitting(false);
    }
  }

  const checkedCount = useMemo(() => items.filter((i) => i.checkedToday).length, [items]);

  if (loadError) {
    return (
      <div className="employee-stock-check-page">
        <div className="employee-stock-check-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="employee-stock-check-page">
      <div className="employee-stock-check-page__header">
        <p className="employee-stock-check-page__summary">
          {isLoading ? 'Loading...' : `${checkedCount} of ${items.length} items checked today`}
        </p>
        <button type="button" className="btn btn--secondary" onClick={() => { setAdHocError(null); setIsAdHocOpen(true); }}>
          <AlertTriangle size={16} />
          Report Shortage
        </button>
      </div>

      {!isLoading && items.length === 0 && (
        <div className="employee-stock-check-page__empty">
          No inventory items are assigned to your store yet.
        </div>
      )}

      <div className="employee-stock-check-page__list">
        {items.map((item) => {
          const draft = drafts[item.storeInventoryItemId];
          const isPending = pendingId === item.storeInventoryItemId;
          const liveQuantityNeeded = draft != null ? quantityNeededFor(item, draft) : item.quantityNeeded;

          return (
            <div key={item.storeInventoryItemId} className="employee-stock-check-page__row">
              <div className="employee-stock-check-page__row-info">
                <p className="employee-stock-check-page__row-name">{item.itemName}</p>
                <p className="employee-stock-check-page__row-meta">
                  {item.categoryName} · Target: {item.minTarget ?? '—'} {item.unitOfMeasurement}
                </p>
              </div>
              <div className="employee-stock-check-page__row-input">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  className="input employee-stock-check-page__count-input"
                  value={draft ?? (item.currentCount != null ? String(item.currentCount) : '')}
                  disabled={isPending}
                  onChange={(event) =>
                    setDrafts((current) => ({ ...current, [item.storeInventoryItemId]: event.target.value }))
                  }
                  onBlur={() => handleSubmitCount(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
                  }}
                />
                <span className="employee-stock-check-page__unit">{item.unitOfMeasurement}</span>
              </div>
              <div className="employee-stock-check-page__row-needed">
                <span className="employee-stock-check-page__needed-label">Needed</span>
                <span
                  className={`employee-stock-check-page__needed-value${liveQuantityNeeded && liveQuantityNeeded > 0 ? ' employee-stock-check-page__needed-value--shortage' : ''}`}
                >
                  {liveQuantityNeeded ?? '—'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <AdHocShortageModal
        isOpen={isAdHocOpen}
        items={items}
        errorMessage={adHocError}
        isSubmitting={isAdHocSubmitting}
        onClose={() => setIsAdHocOpen(false)}
        onSubmit={handleAdHocSubmit}
      />
    </div>
  );
}

export default EmployeeStockCheck;
