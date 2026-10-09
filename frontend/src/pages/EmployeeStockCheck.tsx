import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, History, Info, List } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { ApiError } from '../api/client';
import { getMe } from '../api/me';
import { getTodayStockCheck, reportAdHocShortage, submitStockCheck } from '../api/stockChecks';
import type { DailyStockCheckItem, StockCheckSnapshotKey } from '../types/stockCheck';
import type { StoreSummary } from '../types/store';
import AdHocShortageModal, { type AdHocShortageValues } from '../components/AdHocShortageModal';
import EmployeeStockCheckHistory from '../components/EmployeeStockCheckHistory';
import StockSnapshotCard from '../components/StockSnapshotCard';
import ItemIcon from '../components/ItemIcon';
import SearchInput from '../components/SearchInput';
import './EmployeeStockCheck.css';

interface EmployeeStockCheckProps {
  store: StoreSummary;
  // Changes whenever something outside (a notification click) asks for fresh
  // data; 0 means never asked.
  refreshSignal?: number;
}

const SNAPSHOT_LABELS: Record<StockCheckSnapshotKey, string> = {
  START_OF_DAY: 'Start of Day Stock Check',
  END_OF_DAY: 'End of Day Stock Check',
};

type StatusFilter = 'all' | 'shortage' | 'optimal';
type ItemStatus = 'shortage' | 'optimal' | 'pending';

interface StockCheckViewItem extends DailyStockCheckItem {
  available: number | null;
  needed: number | null;
  status: ItemStatus;
}

// "Available" is the latest known count (End of Day once saved, else the
// running current stock: Start of Day plus deliveries, or the last mid-day
// shortage report), so a live shortage/optimal indicator can show before End of Day is
// saved. This is a display-only estimate -- it never feeds quantityToOrder,
// which the backend only finalizes once End of Day is saved.
function toViewItem(item: DailyStockCheckItem): StockCheckViewItem {
  const available = item.endOfDay?.usable ?? item.currentStock ?? item.startOfDay?.usable ?? null;
  const needed = item.minTarget != null && available != null ? Math.max(0, item.minTarget - available) : null;
  const status: ItemStatus = needed != null && needed > 0 ? 'shortage' : available != null ? 'optimal' : 'pending';
  return { ...item, available, needed, status };
}

// Each item gets two independent counts per day -- Start of Day and End of
// Day -- with no time window on either. Saving a count again updates it.
type View = 'today' | 'history';

function EmployeeStockCheck({ store, refreshSignal = 0 }: EmployeeStockCheckProps) {
  const [view, setView] = useState<View>('today');
  const [myUserId, setMyUserId] = useState<number | null>(null);

  useEffect(() => {
    getMe().then((me) => setMyUserId(me.id)).catch(() => setMyUserId(null));
  }, []);
  const [historyTotal, setHistoryTotal] = useState<number | null>(null);
  const [items, setItems] = useState<DailyStockCheckItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isAdHocOpen, setIsAdHocOpen] = useState(false);
  const [adHocError, setAdHocError] = useState<string | null>(null);
  const [isAdHocSubmitting, setIsAdHocSubmitting] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [collapsedOverrides, setCollapsedOverrides] = useState<Record<number, boolean>>({});

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

  // Quiet refetch (no spinner) so counts being typed aren't wiped. Skips the
  // value present at mount, since the effect above already loads then.
  const handledRefresh = useRef(refreshSignal);
  useEffect(() => {
    if (refreshSignal === handledRefresh.current) return;
    handledRefresh.current = refreshSignal;
    setView('today');
    getTodayStockCheck(store.id).then(setItems).catch(() => {});
  }, [refreshSignal]);

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
                quantityReceived: saved.quantityReceived ?? i.quantityReceived,
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
      // 403/404/409 mean the list on screen is out of date (e.g. the owner
      // deactivated or removed this item after it loaded), so re-fetch it
      // quietly -- no spinner, so the rest of the page stays put.
      if (error instanceof ApiError && [403, 404, 409].includes(error.status)) {
        getTodayStockCheck(store.id).then(setItems).catch(() => {});
      }
      return false;
    } finally {
      setPendingKey(null);
    }
  }

  async function handleAdHocSubmit(values: AdHocShortageValues) {
    setAdHocError(null);
    setIsAdHocSubmitting(true);
    try {
      await reportAdHocShortage(
        store.id,
        values.storeInventoryItemId,
        Number(values.currentStock),
        Number(values.quantity),
        values.note,
      );
      nfToast.success('Shortage reported to your owner.');
      setIsAdHocOpen(false);
      // Current stock and usage changed server-side; pick them up quietly.
      getTodayStockCheck(store.id).then(setItems).catch(() => {});
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

  // Report Shortage is only open once today's Start of Day count has been
  // given, and only for the items that have one. Once End of Day is saved the
  // day is settled, so those items drop out.
  const adHocItemOptions = useMemo(
    () =>
      items
        .filter((i) => i.startOfDay != null && i.endOfDay == null)
        .map((i) => ({
          storeInventoryItemId: i.storeInventoryItemId,
          itemName: i.itemName,
          unitOfMeasurement: i.unitOfMeasurement,
          active: true,
          currentStock: i.currentStock,
        })),
    [items],
  );
  const canReportShortage = adHocItemOptions.length > 0;

  const viewItems = useMemo(() => items.map(toViewItem), [items]);

  const shortageCount = useMemo(() => viewItems.filter((i) => i.status === 'shortage').length, [viewItems]);
  const optimalCount = useMemo(() => viewItems.filter((i) => i.status === 'optimal').length, [viewItems]);

  function isExpanded(item: StockCheckViewItem): boolean {
    return collapsedOverrides[item.storeInventoryItemId] ?? item.status === 'shortage';
  }

  function toggleExpanded(item: StockCheckViewItem) {
    setCollapsedOverrides((current) => ({
      ...current,
      [item.storeInventoryItemId]: !isExpanded(item),
    }));
  }

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return viewItems.filter((item) => {
      if (statusFilter !== 'all' && item.status !== statusFilter) return false;
      if (query === '') return true;
      return (
        item.itemName.toLowerCase().includes(query) ||
        item.unitOfMeasurement.toLowerCase().includes(query)
      );
    });
  }, [viewItems, search, statusFilter]);

  return (
    <div className="employee-stock-check-page">
      <div className="employee-stock-check-page__tabs" role="tablist" aria-label="Stock check view">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'today'}
          className={`employee-stock-check-page__tab${view === 'today' ? ' employee-stock-check-page__tab--active' : ''}`}
          onClick={() => setView('today')}
        >
          <List size={14} />
          Daily Stock Entry
          {!isLoading && <span className="employee-stock-check-page__tab-count">{items.length}</span>}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'history'}
          className={`employee-stock-check-page__tab${view === 'history' ? ' employee-stock-check-page__tab--active' : ''}`}
          onClick={() => setView('history')}
        >
          <History size={14} />
          Stock Check History
          {historyTotal != null && <span className="employee-stock-check-page__tab-count">{historyTotal}</span>}
        </button>
      </div>

      {view === 'history' ? (
        <EmployeeStockCheckHistory storeId={store.id} onTotalChange={setHistoryTotal} />
      ) : loadError ? (
        <div className="employee-stock-check-page__error">
          {loadError}
          <button type="button" className="btn btn--secondary" onClick={load}>
            Retry
          </button>
        </div>
      ) : (
        <>
      <div className="employee-stock-check-page__header">
        <div>
          <h1 className="employee-stock-check-page__title">Daily Stock Check</h1>
          <p className="employee-stock-check-page__subtitle">
            Enter on-hand shelf counts. System will automatically compute orders against store par levels.
          </p>
          <p className="employee-stock-check-page__summary">
            {isLoading
              ? 'Loading...'
              : `Start of Day: ${startCount} of ${items.length} · End of Day: ${endCount} of ${items.length}`}
          </p>
        </div>
        <button
          type="button"
          className="btn btn--danger"
          disabled={isLoading || !canReportShortage}
          title={canReportShortage ? undefined : 'Submit a Start of Day stock check first'}
          onClick={() => {
            setAdHocError(null);
            setIsAdHocOpen(true);
          }}
        >
          <AlertTriangle size={16} />
          Report Shortage
        </button>
      </div>

      {!isLoading && items.length === 0 && (
        <div className="employee-stock-check-page__empty">
          No inventory items are assigned to your store yet.
        </div>
      )}

      {!isLoading && items.length > 0 && (
        <div className="employee-stock-check-page__toolbar">
          <div className="employee-stock-check-page__toolbar-row">
            <div className="filter--search employee-stock-check-page__search">
              <SearchInput
                variant="filter"
                value={search}
                onChange={setSearch}
                placeholder="Search stock items, SKUs, categories..."
              />
            </div>
            <p className="employee-stock-check-page__formula-hint">
              <Info size={13} />
              <span>
                <strong>Formula:</strong> Quantity Needed = Minimum Target − Available Count
              </span>
            </p>
          </div>
          <div className="employee-stock-check-page__filters" role="group" aria-label="Filter by status">
            <button
              type="button"
              className={`employee-stock-check-page__filter-pill${statusFilter === 'all' ? ' employee-stock-check-page__filter-pill--active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All Items ({viewItems.length})
            </button>
            <button
              type="button"
              className={`employee-stock-check-page__filter-pill${statusFilter === 'shortage' ? ' employee-stock-check-page__filter-pill--active' : ''}`}
              onClick={() => setStatusFilter('shortage')}
            >
              Shortage ({shortageCount})
            </button>
            <button
              type="button"
              className={`employee-stock-check-page__filter-pill${statusFilter === 'optimal' ? ' employee-stock-check-page__filter-pill--active' : ''}`}
              onClick={() => setStatusFilter('optimal')}
            >
              Optimal ({optimalCount})
            </button>
          </div>
        </div>
      )}

      {!isLoading && items.length > 0 && visibleItems.length === 0 && (
        <div className="employee-stock-check-page__empty">No items match your search or filter.</div>
      )}

      <div className="employee-stock-check-page__list">
        {visibleItems.map((item) => {
          const idPrefix = `stock-${item.storeInventoryItemId}`;
          const expanded = isExpanded(item);
          const shiftsActive = (item.startOfDay != null ? 1 : 0) + (item.endOfDay != null ? 1 : 0);
          return (
            <article
              key={item.storeInventoryItemId}
              className={`employee-stock-check-page__item${item.status === 'shortage' ? ' employee-stock-check-page__item--shortage' : ''}${item.status === 'optimal' ? ' employee-stock-check-page__item--optimal' : ''}`}
            >
              <div className="employee-stock-check-page__item-header">
                <div className="employee-stock-check-page__item-identity">
                  <ItemIcon id={item.storeInventoryItemId} name={item.itemName} imageId={item.imageId} />
                  <div>
                    <h2 className="employee-stock-check-page__item-name">{item.itemName}</h2>
                    <p className="employee-stock-check-page__item-meta">
                      Today&apos;s target: {item.minTarget ?? '—'} {item.unitOfMeasurement}
                    </p>
                  </div>
                </div>
                <div className="employee-stock-check-page__item-chips">
                  <div className="employee-stock-check-page__available">
                    <span className="employee-stock-check-page__available-label">Available:</span>
                    <span className="employee-stock-check-page__available-pill">
                      {item.available ?? '—'}
                      <span className="employee-stock-check-page__available-tag">Auto-calc</span>
                    </span>
                    {item.minTarget != null && (
                      <span className="employee-stock-check-page__available-target">/ {item.minTarget} target</span>
                    )}
                  </div>
                  {item.status === 'shortage' && (
                    <>
                      <span className="badge badge--dot badge--danger">{item.needed} {item.unitOfMeasurement} Needed</span>
                      <span className="badge badge--danger">Shortage</span>
                    </>
                  )}
                  {item.status === 'optimal' && (
                    <>
                      <span className="badge badge--dot badge--success">{item.needed ?? 0} Sufficient</span>
                      <span className="badge badge--success">Par Met</span>
                    </>
                  )}
                  <button
                    type="button"
                    className="employee-stock-check-page__collapse-toggle"
                    aria-expanded={expanded}
                    aria-label={expanded ? `Collapse ${item.itemName}` : `Expand ${item.itemName}`}
                    onClick={() => toggleExpanded(item)}
                  >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>
              </div>

              {expanded && (
                <>
                  <div className="employee-stock-check-page__shift-header">
                    <span className="employee-stock-check-page__shift-label">
                      Shift Stock Reconciliations
                      <span className={`badge ${item.status === 'optimal' ? 'badge--success' : 'badge--danger'}`}>
                        {shiftsActive} Shifts Active
                      </span>
                    </span>
                    <span className="employee-stock-check-page__shift-target">
                      Reconciliation Target: {item.minTarget ?? '—'} {item.unitOfMeasurement} / day
                    </span>
                  </div>

                  <div className="employee-stock-check-page__snapshots">
                    {(['START_OF_DAY', 'END_OF_DAY'] as const).map((snapshot) => (
                      <StockSnapshotCard
                        key={snapshot}
                        canEdit={(() => {
                          const saved = snapshot === 'START_OF_DAY' ? item.startOfDay : item.endOfDay;
                          return !saved || saved.enteredById == null || myUserId == null || saved.enteredById === myUserId;
                        })()}
                        title={SNAPSHOT_LABELS[snapshot]}
                        unit={item.unitOfMeasurement}
                        idPrefix={`${idPrefix}-${snapshot === 'START_OF_DAY' ? 'sod' : 'eod'}`}
                        snapshot={snapshot === 'START_OF_DAY' ? item.startOfDay : item.endOfDay}
                        isSubmitting={pendingKey === `${item.storeInventoryItemId}:${snapshot}`}
                        onSave={(available, deadStock) => handleSave(item, snapshot, available, deadStock)}
                        savedLabel={snapshot === 'END_OF_DAY' ? 'Completed' : 'Editable Count'}
                        footer={
                          snapshot === 'START_OF_DAY' ? (
                            <>Opening Stock: <strong>{item.startOfDay?.usable ?? '—'} {item.unitOfMeasurement}</strong></>
                          ) : item.quantityToOrder != null && item.quantityToOrder > 0 ? (
                            <>
                              Usage: <strong>{item.stockUsed ?? '—'} {item.unitOfMeasurement}</strong> · To Order:{' '}
                              <strong>{item.quantityToOrder} {item.unitOfMeasurement}</strong>
                            </>
                          ) : item.endOfDay != null && item.minTarget != null && item.available != null ? (
                            <>
                              Usage: <strong>{item.stockUsed ?? '—'} {item.unitOfMeasurement}</strong> · Buffer:{' '}
                              <strong>+{item.available - item.minTarget} {item.unitOfMeasurement}</strong>
                            </>
                          ) : (
                            <>Usage: <strong>{item.stockUsed ?? '—'} {item.unitOfMeasurement}</strong></>
                          )
                        }
                      />
                    ))}
                  </div>

                  <div
                    className={`employee-stock-check-page__totals${item.status === 'optimal' ? ' employee-stock-check-page__totals--optimal' : ''}`}
                  >
                    {item.status === 'optimal' ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                    {item.status === 'optimal' ? (
                      <span>
                        Reconciliation: <strong>Optimal buffer maintained</strong>
                        {item.available != null && item.minTarget != null && (
                          <> (+{item.available - item.minTarget} {item.unitOfMeasurement})</>
                        )}{' '}
                        · No order required
                      </span>
                    ) : (
                      <span>
                        Reconciliation: Stock used today: <strong>{item.stockUsed ?? '—'}</strong> {item.unitOfMeasurement}
                        {item.quantityReceived ? <> (excl. {item.quantityReceived} received)</> : null} · Tomorrow
                        opening need: <strong>{item.requiredTomorrow ?? '—'}</strong> {item.unitOfMeasurement}
                      </span>
                    )}
                    <span className="employee-stock-check-page__totals-spacer" />
                    {item.status === 'optimal' ? (
                      <span>Par satisfied for current cycle</span>
                    ) : (
                      <span>
                        To order:{' '}
                        <strong
                          className={item.quantityToOrder && item.quantityToOrder > 0 ? 'employee-stock-check-page__shortage' : undefined}
                        >
                          {item.quantityToOrder ?? '—'}
                        </strong>
                      </span>
                    )}
                  </div>
                </>
              )}
            </article>
          );
        })}
      </div>

      <AdHocShortageModal
        isOpen={isAdHocOpen}
        items={adHocItemOptions}
        errorMessage={adHocError}
        isSubmitting={isAdHocSubmitting}
        onClose={() => setIsAdHocOpen(false)}
        onSubmit={handleAdHocSubmit}
      />
        </>
      )}
    </div>
  );
}

export default EmployeeStockCheck;
