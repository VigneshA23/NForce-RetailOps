import { useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthlyCashSummary, getSuperAdminMonthlyCashSummary } from '../api/cashSummary';
import { getAllStores } from '../api/superAdminStores';
import type { SuperAdminStore } from '../types/superAdminStore';
import type { MonthlyCashSummary as Summary, StoreMonthlyCashSummary } from '../types/cashSummary';
import StoreCashSummaryView from '../components/StoreCashSummaryView';
import SearchableSelect from '../components/SearchableSelect';
// The month selector reuses the Daily Checklist's date-nav look.
import './StoreDetail.css';
import './MonthlyCashSummary.css';

interface MonthlyCashSummaryProps {
  // 'owner': the caller's own store.
  // 'super-admin': pick a store (or All Stores) first, like the Daily Checklist.
  scope?: 'owner' | 'super-admin';
}

const COMBINED_SELECTION = 'combined';
// Super Admin has not picked anything yet: tiles show dashes and a prompt.
const NO_SELECTION = null;
type StoreSelection = typeof NO_SELECTION | string;

// Nothing to show yet -- every amount null, so the tiles read "-", never $0.00.
const NOTHING_SELECTED: StoreMonthlyCashSummary = {
  storeId: null, storeName: '', storeCode: null, daysRecorded: 0, asOfDate: null,
  totalCashSales: null, totalCashRemoved: null, bankDeposits: null, cashExpenses: null, adjustments: null,
  expectedCashOnHand: null, actualCashCount: null, variance: null, netDailyVariance: null, dailyBreakdown: [],
};

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

// Month-End Cash Summary (RTS-297): the month's cash flows and closing position
// as tiles, with the rows behind them -- one per recorded day for a store, one
// per store for All Stores. Laid out like the Daily Checklist: period selector
// on the left, store selector on the right, tiles always visible (dashes until a
// store is chosen). Flow figures are month totals; expected, actual and variance
// are each store's position on its last recorded day.
function MonthlyCashSummary({ scope = 'owner' }: MonthlyCashSummaryProps) {
  const isSuperAdmin = scope === 'super-admin';
  const [month, setMonth] = useState(currentMonth);
  const [storeSelection, setStoreSelection] = useState<StoreSelection>(isSuperAdmin ? COMBINED_SELECTION : NO_SELECTION);
  const [stores, setStores] = useState<SuperAdminStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(isSuperAdmin);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [storesReloadToken, setStoresReloadToken] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!isSuperAdmin) return;
    let active = true;
    setStoresLoading(true);
    setStoresError(null);
    getAllStores()
      .then((result) => {
        if (active) {
          setStores(result);
          setStoreSelection((selection) => selection === NO_SELECTION || selection === COMBINED_SELECTION
            || result.some((store) => String(store.storeId) === selection)
            ? selection
            : NO_SELECTION);
        }
      })
      .catch((cause: unknown) => {
        if (active) setStoresError(cause instanceof Error ? cause.message : 'Could not load stores');
      })
      .finally(() => {
        if (active) setStoresLoading(false);
      });
    return () => { active = false; };
  }, [isSuperAdmin, storesReloadToken]);

  useEffect(() => {
    // Super Admin: nothing to fetch until a store (or All Stores) is chosen.
    if (isSuperAdmin && storeSelection === NO_SELECTION) {
      setSummary(null);
      setError(null);
      setIsLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    const selectedStoreId = storeSelection === COMBINED_SELECTION || storeSelection === NO_SELECTION
      ? undefined
      : Number(storeSelection);
    const load = isSuperAdmin
      ? getSuperAdminMonthlyCashSummary(month, controller.signal, selectedStoreId)
      : getMonthlyCashSummary(month, controller.signal);
    load
      .then((data) => setSummary(data))
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setSummary(null);
        setError(cause instanceof Error ? cause.message : 'Could not load the cash summary');
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, [isSuperAdmin, month, reloadToken, storeSelection]);

  // Same option shape as the Daily Checklist's store selector.
  const storeSelectOptions = useMemo(
    () => stores.map((store) => ({ id: store.storeId, label: store.storeName, sublabel: `#${store.storeCode}` })),
    [stores],
  );

  const isCurrentMonth = month === currentMonth();
  const showCombined = isSuperAdmin && storeSelection === COMBINED_SELECTION;
  const awaitingStore = isSuperAdmin && storeSelection === NO_SELECTION;
  const column: StoreMonthlyCashSummary | null = awaitingStore
    ? NOTHING_SELECTED
    : summary
      ? showCombined ? summary.combined : summary.stores[0] ?? null
      : null;

  return (
    <div className="cash-summary">
      <div className="cash-summary__toolbar">
        <div className="store-detail-page__date-nav" role="group" aria-label="Month">
          <button
            type="button"
            className="store-detail-page__date-arrow"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="store-detail-page__date-display" aria-live="polite">
            <Calendar size={13} />
            {monthLabel(month)}
          </span>
          <button
            type="button"
            className="store-detail-page__date-arrow"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
            disabled={isCurrentMonth}
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {isSuperAdmin && (
          <div className="cash-summary__store-select">
            <SearchableSelect
              id="cash-summary-store"
              options={storeSelectOptions}
              selectedIds={storeSelection === NO_SELECTION || storeSelection === COMBINED_SELECTION
                ? []
                : [Number(storeSelection)]}
              onChange={(ids) => setStoreSelection(ids.length > 0 ? String(ids[0]) : NO_SELECTION)}
              placeholder="Select a store…"
              isLoading={storesLoading}
              error={storesError}
              onRetry={() => setStoresReloadToken((token) => token + 1)}
              emptyMessage="No stores found"
              allOption={{
                label: 'All Stores',
                selected: storeSelection === COMBINED_SELECTION,
                onToggle: () => setStoreSelection(COMBINED_SELECTION),
              }}
            />
          </div>
        )}
      </div>

      {error ? (
        <div className="cash-summary__alert" role="alert">
          <span>{error}</span>
          <button type="button" className="btn btn--secondary btn--sm" onClick={() => setReloadToken((t) => t + 1)}>
            Retry
          </button>
        </div>
      ) : isLoading && !summary && !awaitingStore ? (
        <p className="cash-summary__status">Loading cash summary…</p>
      ) : !column ? (
        <p className="cash-summary__status">No stores to summarise.</p>
      ) : (
        <div className={`cash-summary__store-view${isLoading ? ' cash-summary__store-view--loading' : ''}`}>
          <StoreCashSummaryView
            summary={column}
            storeRows={showCombined && summary ? summary.stores : undefined}
            emptyMessage={awaitingStore
              ? 'Select a store above to view its month-end cash summary.'
              : `No daily cash entries were recorded in ${monthLabel(month)}.`}
          />
          <p className="cash-summary__footnote">Expected cash, actual count and variance are as at the last day recorded. Negative variance is a shortage, positive is an overage.</p>
        </div>
      )}
    </div>
  );
}

export default MonthlyCashSummary;
