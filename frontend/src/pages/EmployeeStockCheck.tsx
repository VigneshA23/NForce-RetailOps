import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { getTodayStockCheck, reportAdHocShortage, submitStockCheck } from '../api/stockChecks';
import type { DailyStockCheckItem, StockCheckSnapshotKey } from '../types/stockCheck';
import type { StoreSummary } from '../types/store';
import AdHocShortageModal, { type AdHocShortageValues } from '../components/AdHocShortageModal';
import StockSnapshotCard from '../components/StockSnapshotCard';
import './EmployeeStockCheck.css';

interface EmployeeStockCheckProps {
  store: StoreSummary;
}

const SNAPSHOT_LABELS: Record<StockCheckSnapshotKey, string> = {
  START_OF_DAY: 'Start of Day',
  END_OF_DAY: 'End of Day',
};

// Each item gets two independent counts per day -- Start of Day and End of
// Day -- with no time window on either. Saving a count again updates it.
function EmployeeStockCheck({ store }: EmployeeStockCheckProps) {
  const [items, setItems] = useState<DailyStockCheckItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
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

  async function handleSave(
    item: DailyStockCheckItem,
    snapshot: StockCheckSnapshotKey,
    available: number,
    deadStock: number,
  ): Promise<boolean> {
    if (pendingKey != null) return false;
    const key = `${item.storeInventoryItemId}:${snapshot}`;
    const isUpdate = (snapshot === 'START_OF_DAY' ? item.startOfDay : item.endOfDay) != null;
    setPendingKey(key);
    try {
      const saved = await submitStockCheck(store.id, item.storeInventoryItemId, snapshot, available, deadStock);
      setItems((current) =>
        current.map((i) =>
          i.storeInventoryItemId === item.storeInventoryItemId
            ? {
                ...i,
                startOfDay: saved.startOfDay,
                endOfDay: saved.endOfDay,
                stockUsed: saved.stockUsed,
                requiredTomorrow: saved.requiredTomorrow ?? i.requiredTomorrow,
                quantityToOrder: saved.quantityToOrder,
              }
            : i,
        ),
      );
      nfToast.success(`${item.itemName} ${SNAPSHOT_LABELS[snapshot]} ${isUpdate ? 'updated' : 'saved'}.`);
      return true;
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Failed to save count');
      return false;
    } finally {
      setPendingKey(null);
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

  const startCount = useMemo(() => items.filter((i) => i.startOfDay != null).length, [items]);
  const endCount = useMemo(() => items.filter((i) => i.endOfDay != null).length, [items]);

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
          {isLoading
            ? 'Loading...'
            : `Start of Day: ${startCount} of ${items.length} · End of Day: ${endCount} of ${items.length}`}
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
          const idPrefix = `stock-${item.storeInventoryItemId}`;
          return (
            <article key={item.storeInventoryItemId} className="employee-stock-check-page__item">
              <div className="employee-stock-check-page__item-header">
                <h2 className="employee-stock-check-page__item-name">{item.itemName}</h2>
                <p className="employee-stock-check-page__item-meta">
                  Today&apos;s target: {item.minTarget ?? '—'} {item.unitOfMeasurement}
                </p>
              </div>

              <div className="employee-stock-check-page__snapshots">
                {(['START_OF_DAY', 'END_OF_DAY'] as const).map((snapshot) => (
                  <StockSnapshotCard
                    key={snapshot}
                    title={SNAPSHOT_LABELS[snapshot]}
                    idPrefix={`${idPrefix}-${snapshot === 'START_OF_DAY' ? 'sod' : 'eod'}`}
                    unit={item.unitOfMeasurement}
                    snapshot={snapshot === 'START_OF_DAY' ? item.startOfDay : item.endOfDay}
                    isSubmitting={pendingKey === `${item.storeInventoryItemId}:${snapshot}`}
                    onSave={(available, deadStock) => handleSave(item, snapshot, available, deadStock)}
                  />
                ))}
              </div>

              <div className="employee-stock-check-page__totals">
                <span>
                  Stock used: <strong>{item.stockUsed ?? '—'}</strong>
                </span>
                <span>
                  Needed tomorrow: <strong>{item.requiredTomorrow ?? '—'}</strong>
                </span>
                <span>
                  To order:{' '}
                  <strong
                    className={item.quantityToOrder && item.quantityToOrder > 0 ? 'employee-stock-check-page__shortage' : undefined}
                  >
                    {item.quantityToOrder ?? '—'}
                  </strong>
                </span>
              </div>
            </article>
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
