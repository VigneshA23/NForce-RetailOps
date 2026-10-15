import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, History, Info, List, Lock } from 'lucide-react';
import { nfToast } from '../utils/toast';
import { ApiError } from '../api/client';
import { getMe } from '../api/me';
import { getTodayStockCheck, reportAdHocShortage, submitStockCheck } from '../api/stockChecks';
import type { DailyStockCheckItem, StockCheckSnapshotKey } from '../types/stockCheck';
import type { StoreSummary } from '../types/store';
import AdHocShortageModal, { type AdHocShortageValues } from '../components/AdHocShortageModal';
import EmployeeStockCheckHistory from '../components/EmployeeStockCheckHistory';
import LowerCountModal from '../components/LowerCountModal';
import MissedEndOfDayBlockModal from '../components/MissedEndOfDayBlockModal';
import ReceivedStockModal, { type ReceivedItemInput } from '../components/ReceivedStockModal';
import { roundQty } from '../utils/quantity';
import StockSnapshotCard from '../components/StockSnapshotCard';
import ItemIcon from '../components/ItemIcon';
import SearchInput from '../components/SearchInput';
import './EmployeeStockCheck.css';

interface EmployeeStockCheckProps {
  store: StoreSummary;
  // Changes whenever something outside (a notification click) asks for fresh
  // data; 0 means never asked.
  refreshSignal?: number;
  // Takes the employee to the Notifications page, where a missing End of Day
  // from yesterday is answered.
  onOpenNotifications?: () => void;
}

const SNAPSHOT_LABELS: Record<StockCheckSnapshotKey, string> = {
  START_OF_DAY: 'Start of Day Stock Check',
  END_OF_DAY: 'End of Day Stock Check',
};

type StatusFilter = 'all' | 'shortage' | 'sufficient';
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

function EmployeeStockCheck({ store, refreshSignal = 0, onOpenNotifications }: EmployeeStockCheckProps) {
  const [view, setView] = useState<View>('today');
  const [missedBlock, setMissedBlock] = useState<DailyStockCheckItem | null>(null);
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
  const [receivedPrompt, setReceivedPrompt] = useState<{
    item: DailyStockCheckItem;
    available: number;
    deadStock: number;
    startUsable: number;
    endUsable: number;
    snapshot: StockCheckSnapshotKey;
    resolve: (saved: boolean) => void;
  } | null>(null);
  const [lowerPrompt, setLowerPrompt] = useState<{
    item: DailyStockCheckItem;
    available: number;
    deadStock: number;
    countedUsable: number;
    expectedUsable: number;
    resolve: (saved: boolean) => void;
  } | null>(null);

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

  // An End of Day count above Start of Day (plus anything already logged as
  // received) can only mean stock arrived, so ask before saving: usage is then
  // worked out against what was received instead of coming out negative.
  async function handleSave(
    staleItem: DailyStockCheckItem,
    snapshot: StockCheckSnapshotKey,
    available: number,
    deadStock: number,
  ): Promise<boolean> {
    if (pendingKey != null) return false;
    // Yesterday's End of Day for this item is still unanswered: Start of Day
    // waits until it is (the server refuses it too).
    if (snapshot === 'START_OF_DAY' && staleItem.missedEndOfDay && staleItem.startOfDay == null) {
      setMissedBlock(staleItem);
      return false;
    }
    let item = staleItem;
    if (snapshot === 'END_OF_DAY') {
      // The page can be open for hours: an admin may have marked an order
      // Received since it loaded, which changes what counts as already
      // received. Re-read the latest figures before deciding to ask. If the
      // refetch fails, fall back to what is on screen; the server still
      // validates the count.
      // The refetch can take a moment, so show the button's loading state
      // meanwhile (as Start of Day does) instead of leaving it looking idle.
      setPendingKey(`${staleItem.storeInventoryItemId}:${snapshot}`);
      try {
        const fresh = await getTodayStockCheck(store.id);
        setItems(fresh);
        item = fresh.find((i) => i.storeInventoryItemId === staleItem.storeInventoryItemId) ?? staleItem;
      } catch {
        // keep the on-screen item
      } finally {
        setPendingKey(null);
      }
    }
    if (snapshot === 'END_OF_DAY' && item.startOfDay != null) {
      const endUsable = available - deadStock;
      const startUsable = item.startOfDay.usable;
      if (endUsable > startUsable + (item.quantityReceived ?? 0) + (item.pendingReceivedQuantity ?? 0)) {
        return new Promise<boolean>((resolve) => {
          setReceivedPrompt({ item, available, deadStock, startUsable, endUsable, snapshot: 'END_OF_DAY', resolve });
        });
      }
    }
    // Start of Day must match the last End of Day (plus anything received
    // since). Above it means a restock to declare; below it needs a reason and
    // the admin's approval. What today's pending or approved requests already
    // explain is not asked about again.
    const previous = item.previousEndOfDay;
    if (snapshot === 'START_OF_DAY' && previous != null) {
      const startUsable = roundQty(available - deadStock);
      if (startUsable > roundQty(previous.expectedStart + previous.restockCovered)) {
        return new Promise<boolean>((resolve) => {
          setReceivedPrompt({
            item, available, deadStock, startUsable: previous.expectedStart, endUsable: startUsable, snapshot: 'START_OF_DAY', resolve,
          });
        });
      }
      if (startUsable < previous.expectedStart && roundQty(previous.expectedStart - startUsable) > previous.lowerCovered) {
        return new Promise<boolean>((resolve) => {
          setLowerPrompt({ item, available, deadStock, countedUsable: startUsable, expectedUsable: previous.expectedStart, resolve });
        });
      }
    }
    return saveCount(item, snapshot, available, deadStock);
  }

  async function confirmLower(reason: string) {
    if (lowerPrompt == null) return;
    const { item, available, deadStock, resolve } = lowerPrompt;
    const saved = await saveCount(item, 'START_OF_DAY', available, deadStock, undefined, reason);
    if (saved) {
      getTodayStockCheck(store.id).then(setItems).catch(() => {});
      setLowerPrompt(null);
      resolve(true);
    }
  }

  function cancelLower() {
    lowerPrompt?.resolve(false);
    setLowerPrompt(null);
  }

  async function confirmReceived(received: ReceivedItemInput[]) {
    if (receivedPrompt == null) return;
    const { item, available, deadStock, snapshot, resolve } = receivedPrompt;
    const saved = await saveCount(item, snapshot, available, deadStock, received.map((r) => ({ orderEntryId: r.orderId, quantity: r.quantity })));
    // Keep the prompt open on failure so the employee can retry or cancel.
    if (saved) {
      // The report is only a request until the admin approves it; pick up the
      // pending figure the save response doesn't carry.
      getTodayStockCheck(store.id).then(setItems).catch(() => {});
      setReceivedPrompt(null);
      resolve(true);
    }
  }

  function cancelReceived() {
    receivedPrompt?.resolve(false);
    setReceivedPrompt(null);
  }

  async function saveCount(
    item: DailyStockCheckItem,
    snapshot: StockCheckSnapshotKey,
    available: number,
    deadStock: number,
    receivedItems?: { orderEntryId: number | null; quantity: number }[],
    lowerCountReason?: string,
  ): Promise<boolean> {
    if (pendingKey != null) return false;
    const key = `${item.storeInventoryItemId}:${snapshot}`;
    const isUpdate = (snapshot === 'START_OF_DAY' ? item.startOfDay : item.endOfDay) != null;
    setPendingKey(key);
    try {
      const saved = await submitStockCheck(store.id, item.storeInventoryItemId, snapshot, available, deadStock, receivedItems, lowerCountReason);
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
      if (receivedItems != null && receivedItems.length > 0) {
        nfToast.success('Received stock sent to your admin for approval. Stock updates once they approve it.');
      }
      if (lowerCountReason) {
        nfToast.success('Lower Start of Day count sent to your admin for approval.');
      }
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
        values.note,
        values.orderedAlreadyReceived,
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
          openOrders: i.openOrders,
        })),
    [items],
  );
  const canReportShortage = adHocItemOptions.length > 0;

  const viewItems = useMemo(() => items.map(toViewItem), [items]);

  const shortageCount = useMemo(() => viewItems.filter((i) => i.status === 'shortage').length, [viewItems]);
  const sufficientCount = useMemo(() => viewItems.filter((i) => i.status !== 'shortage').length, [viewItems]);

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
      if (statusFilter === 'shortage' && item.status !== 'shortage') return false;
      if (statusFilter === 'sufficient' && item.status === 'shortage') return false;
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
                <strong>Formula:</strong> Qty Needed = Min Target − Available
              </span>
            </p>
          </div>
          <div className="employee-stock-check-page__filters" role="group" aria-label="Filter by status">
            <button
              type="button"
              className={`employee-stock-check-page__filter-pill${statusFilter === 'all' ? ' employee-stock-check-page__filter-pill--active' : ''}`}
              onClick={() => setStatusFilter('all')}
            >
              All Records ({viewItems.length})
            </button>
            <button
              type="button"
              className={`employee-stock-check-page__filter-pill employee-stock-check-page__filter-pill--shortage${statusFilter === 'shortage' ? ' employee-stock-check-page__filter-pill--active' : ''}`}
              onClick={() => setStatusFilter('shortage')}
            >
              <AlertTriangle size={13} />
              Shortage ({shortageCount})
            </button>
            <button
              type="button"
              className={`employee-stock-check-page__filter-pill employee-stock-check-page__filter-pill--sufficient${statusFilter === 'sufficient' ? ' employee-stock-check-page__filter-pill--active' : ''}`}
              onClick={() => setStatusFilter('sufficient')}
            >
              <CheckCircle2 size={13} />
              Sufficient ({sufficientCount})
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
              {item.missedEndOfDay && item.startOfDay == null && (
                <p className="employee-stock-check-page__review employee-stock-check-page__review--rejected" role="status">
                  <AlertTriangle size={14} /> Yesterday&apos;s End of Day is missing. Respond to it in your notifications before taking Start of Day.
                </p>
              )}
              {item.startOfDayLocked && (
                <p className="employee-stock-check-page__review employee-stock-check-page__review--locked" role="status">
                  <Lock size={14} /> An order has been placed based on the Start of Day count, so you cannot edit it.
                </p>
              )}
              <div
                className="employee-stock-check-page__item-header"
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-label={expanded ? `Collapse ${item.itemName}` : `Expand ${item.itemName}`}
                onClick={() => toggleExpanded(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    toggleExpanded(item);
                  }
                }}
              >
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
                    <span className="badge badge--danger employee-stock-check-page__status-badge">Shortage</span>
                  )}
                  {item.status === 'optimal' && (
                    <span className="badge badge--success employee-stock-check-page__status-badge">Par Met</span>
                  )}
                  <span className="employee-stock-check-page__needed-group">
                    {item.status === 'shortage' && (
                      <span className="badge badge--dot badge--danger employee-stock-check-page__needed-badge">
                        {item.needed} {item.unitOfMeasurement} Needed
                      </span>
                    )}
                    {item.status === 'optimal' && (
                      <span className="badge badge--dot badge--success">{item.needed ?? 0} Sufficient</span>
                    )}
                    <span className="employee-stock-check-page__collapse-toggle" aria-hidden="true">
                      {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </span>
                  </span>
                </div>
              </div>

              {expanded && (
                <>
                  <div className="employee-stock-check-page__shift-header">
                    <span className="employee-stock-check-page__shift-label">
                      Shift Stock Reconciliations
                      <span className={`badge ${shiftsActive === 0 ? 'badge--outline' : item.status === 'optimal' ? 'badge--success' : 'badge--danger'}`}>
                        {shiftsActive} Shifts Active
                      </span>
                    </span>
                    <span className="employee-stock-check-page__shift-target">
                      Reconciliation Target: {item.minTarget ?? '—'} {item.unitOfMeasurement} / day
                    </span>
                  </div>

                  {item.previousEndOfDay && (
                    <p className="employee-stock-check-page__eod-note">
                      Last End of Day ({new Date(`${item.previousEndOfDay.date}T00:00:00`).toLocaleDateString()}):{' '}
                      <strong>{item.previousEndOfDay.usable} {item.unitOfMeasurement}</strong>
                      {item.previousEndOfDay.submittedByName ? <> · submitted by {item.previousEndOfDay.submittedByName}</> : null}
                      {item.previousEndOfDay.expectedStart !== item.previousEndOfDay.usable ? (
                        <> · expected Start of Day: <strong>{item.previousEndOfDay.expectedStart} {item.unitOfMeasurement}</strong> (incl. deliveries received since)</>
                      ) : null}
                    </p>
                  )}
                  {item.startOfDayReview && (
                    <p
                      className={`employee-stock-check-page__review employee-stock-check-page__review--${item.startOfDayReview.status.toLowerCase()}`}
                      role="status"
                    >
                      {item.startOfDayReview.status === 'PENDING'
                        ? item.startOfDayReview.type === 'LOWER_COUNT'
                          ? 'Start of Day is lower than the last End of Day. Waiting for your admin to approve.'
                          : 'Restock reported with Start of Day. Waiting for your admin to approve.'
                        : 'Your admin rejected the Start of Day request. Please recount and save Start of Day again.'}
                    </p>
                  )}
                  <div className="employee-stock-check-page__snapshots">
                    {(['START_OF_DAY', 'END_OF_DAY'] as const).map((snapshot) => (
                      <StockSnapshotCard
                        key={snapshot}
                        canEdit={(() => {
                          if (snapshot === 'START_OF_DAY' && item.startOfDayLocked) return false;
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
                        disabledReason={
                          snapshot === 'END_OF_DAY' && item.startOfDay == null
                            ? 'Submit the Start of Day count first'
                            : undefined
                        }
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
                    className={`employee-stock-check-page__totals${item.status === 'optimal' ? ' employee-stock-check-page__totals--optimal' : ''}${item.status === 'shortage' ? ' employee-stock-check-page__totals--shortage' : ''}`}
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
                        {item.quantityReceived ? <> (excl. {item.quantityReceived} received)</> : null}
                        {item.pendingReceivedQuantity ? <> ({item.pendingReceivedQuantity} received, awaiting admin approval)</> : null} · Tomorrow
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

      <ReceivedStockModal
        isOpen={receivedPrompt != null}
        itemName={receivedPrompt?.item.itemName ?? ''}
        unit={receivedPrompt?.item.unitOfMeasurement ?? ''}
        startUsable={receivedPrompt?.startUsable ?? 0}
        endUsable={receivedPrompt?.endUsable ?? 0}
        snapshot={receivedPrompt?.snapshot}
        alreadyReceived={
          receivedPrompt?.snapshot === 'START_OF_DAY'
            ? receivedPrompt.item.previousEndOfDay?.restockCovered ?? 0
            : (receivedPrompt?.item.quantityReceived ?? 0) + (receivedPrompt?.item.pendingReceivedQuantity ?? 0)
        }
        orders={receivedPrompt?.item.openOrders ?? []}
        isSubmitting={pendingKey != null}
        onConfirm={confirmReceived}
        onCancel={cancelReceived}
      />

      <LowerCountModal
        isOpen={lowerPrompt != null}
        itemName={lowerPrompt?.item.itemName ?? ''}
        unit={lowerPrompt?.item.unitOfMeasurement ?? ''}
        countedUsable={lowerPrompt?.countedUsable ?? 0}
        expectedUsable={lowerPrompt?.expectedUsable ?? 0}
        previousByName={lowerPrompt?.item.previousEndOfDay?.submittedByName ?? null}
        isSubmitting={pendingKey != null}
        onConfirm={confirmLower}
        onCancel={cancelLower}
      />

      <MissedEndOfDayBlockModal
        isOpen={missedBlock != null}
        itemName={missedBlock?.itemName ?? ''}
        date={missedBlock?.missedEndOfDay?.date ?? null}
        onOpenNotifications={() => {
          setMissedBlock(null);
          onOpenNotifications?.();
        }}
        onClose={() => setMissedBlock(null)}
      />

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
