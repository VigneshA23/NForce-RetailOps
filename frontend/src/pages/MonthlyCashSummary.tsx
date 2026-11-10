import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { getMonthlyCashSummary, getSuperAdminMonthlyCashSummary } from '../api/cashSummary';
import { getAllStores } from '../api/superAdminStores';
import type { SuperAdminStore } from '../types/superAdminStore';
import type { MonthlyCashSummary as Summary, StoreMonthlyCashSummary } from '../types/cashSummary';
import { formatCurrency } from '../utils/currency';
import FormField from '../components/FormField';
import SearchableSelect from '../components/SearchableSelect';
import './MonthlyCashSummary.css';

interface MonthlyCashSummaryProps {
  // 'owner': the caller's own store, no Combined column.
  // 'super-admin': every store plus Combined.
  scope?: 'owner' | 'super-admin';
}

type AmountKey = Exclude<keyof StoreMonthlyCashSummary,
  'storeId' | 'storeName' | 'storeCode' | 'daysRecorded' | 'asOfDate'>;
const COMBINED_SELECTION = 'combined';

interface Row {
  key: AmountKey;
  label: string;
  hint?: string;
  emphasis?: boolean;
  variance?: boolean;
}

const ROWS: Row[] = [
  { key: 'totalCashSales', label: 'Total cash sales' },
  { key: 'totalCashRemoved', label: 'Total cash removed' },
  { key: 'bankDeposits', label: 'Bank deposits' },
  { key: 'cashExpenses', label: 'Cash expenses' },
  { key: 'adjustments', label: 'Adjustments' },
  { key: 'expectedCashOnHand', label: 'Expected cash on hand', hint: 'As at the last day recorded', emphasis: true },
  { key: 'actualCashCount', label: 'Actual cash count', hint: 'Cash remaining on that day', emphasis: true },
  { key: 'variance', label: 'Variance', hint: 'Actual − expected', emphasis: true, variance: true },
  { key: 'netDailyVariance', label: 'Net daily variance', hint: 'Every day’s over/short added up', variance: true },
];

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

function dayLabel(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

function varianceClass(value: number | null): string {
  if (value === null || value === 0) return '';
  return value < 0 ? ' cash-summary__amount--short' : ' cash-summary__amount--over';
}

function formatVariance(value: number): string {
  if (value === 0) return formatCurrency(0);
  return value > 0 ? `+${formatCurrency(value)}` : formatCurrency(value);
}

// Month-End Cash Summary (RTS-297): the month's cash totals per store, and a
// Combined column for Super Admin. Flow lines are month totals; expected,
// actual and variance are the cash position on each store's last recorded day.
function MonthlyCashSummary({ scope = 'owner' }: MonthlyCashSummaryProps) {
  const [month, setMonth] = useState(currentMonth);
  const [storeSelection, setStoreSelection] = useState(COMBINED_SELECTION);
  const [stores, setStores] = useState<SuperAdminStore[]>([]);
  const [storesLoading, setStoresLoading] = useState(scope === 'super-admin');
  const [storesError, setStoresError] = useState<string | null>(null);
  const [storesReloadToken, setStoresReloadToken] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (scope !== 'super-admin') return;
    let active = true;
    setStoresLoading(true);
    setStoresError(null);
    getAllStores()
      .then((result) => {
        if (active) {
          setStores(result);
          setStoreSelection((selection) => selection === COMBINED_SELECTION
            || result.some((store) => String(store.storeId) === selection)
            ? selection
            : COMBINED_SELECTION);
        }
      })
      .catch((cause: unknown) => {
        if (active) setStoresError(cause instanceof Error ? cause.message : 'Could not load stores');
      })
      .finally(() => {
        if (active) setStoresLoading(false);
      });
    return () => { active = false; };
  }, [scope, storesReloadToken]);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    setError(null);
    const selectedStoreId = storeSelection === COMBINED_SELECTION ? undefined : Number(storeSelection);
    const load = scope === 'super-admin'
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
  }, [scope, month, reloadToken, storeSelection]);

  const isCurrentMonth = month === currentMonth();
  const columns: StoreMonthlyCashSummary[] = summary
    ? scope === 'super-admin'
      ? storeSelection === COMBINED_SELECTION
        ? [summary.combined]
        : summary.stores
      : summary.stores
    : [];
  const anyData = columns.some((c) => c.daysRecorded > 0);

  return (
    <div className="cash-summary">
      <section className="card cash-summary__card" aria-label="Month-end cash summary">
        <div className="cash-summary__toolbar">
          {scope === 'super-admin' && (
            <div className="cash-summary__store-picker">
              <FormField label="Store" htmlFor="cash-summary-store">
                <SearchableSelect
                  id="cash-summary-store"
                  options={stores.map((store) => ({
                    id: store.storeId,
                    label: store.storeName,
                    sublabel: `#${store.storeCode}`,
                  }))}
                  selectedIds={storeSelection === COMBINED_SELECTION ? [] : [Number(storeSelection)]}
                  onChange={(ids) => setStoreSelection(ids.length > 0 ? String(ids[0]) : COMBINED_SELECTION)}
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
              </FormField>
            </div>
          )}
          <div className="cash-summary__month" role="group" aria-label="Month">
            <button
              type="button"
              className="btn btn--ghost cash-summary__nav"
              onClick={() => setMonth((m) => shiftMonth(m, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={18} />
            </button>
            <h2 className="cash-summary__month-label" aria-live="polite">{monthLabel(month)}</h2>
            <button
              type="button"
              className="btn btn--ghost cash-summary__nav"
              onClick={() => setMonth((m) => shiftMonth(m, 1))}
              disabled={isCurrentMonth}
              aria-label="Next month"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          {summary && (
            <p className="cash-summary__period">
              {isCurrentMonth
                ? `Month to date, ${dayLabel(summary.periodStart)} – ${dayLabel(summary.periodEnd)}`
                : `${dayLabel(summary.periodStart)} – ${dayLabel(summary.periodEnd)}`}
            </p>
          )}
        </div>

        {error ? (
          <div className="cash-summary__alert" role="alert">
            <span>{error}</span>
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setReloadToken((t) => t + 1)}>
              Retry
            </button>
          </div>
        ) : isLoading && !summary ? (
          <p className="cash-summary__status">Loading cash summary…</p>
        ) : columns.length === 0 ? (
          <p className="cash-summary__status">No stores to summarise.</p>
        ) : (
          <>
            {!anyData && (
              <p className="cash-summary__status">No daily cash entries were recorded in {monthLabel(month)}.</p>
            )}
            <div className={`cash-summary__table-wrap${isLoading ? ' cash-summary__table-wrap--loading' : ''}`}>
              <table className="cash-summary__table">
                <thead>
                  <tr>
                    <th scope="col" className="cash-summary__label-col" aria-label="Line" />
                    {columns.map((c) => (
                      <th
                        key={c.storeId ?? 'combined'}
                        scope="col"
                        className={c.storeId === null ? 'cash-summary__combined' : undefined}
                      >
                        <span className="cash-summary__store-name">{c.storeName}</span>
                        <span className="cash-summary__store-meta">
                          {c.daysRecorded === 0
                            ? 'No entries'
                            : `${c.daysRecorded} day${c.daysRecorded === 1 ? '' : 's'}${
                              c.storeId !== null && c.asOfDate ? ` · to ${dayLabel(c.asOfDate)}` : ''}`}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.key} className={row.emphasis ? 'cash-summary__row--emphasis' : undefined}>
                      <th scope="row" className="cash-summary__label-col">
                        {row.label}
                        {row.hint && <span className="cash-summary__hint">{row.hint}</span>}
                      </th>
                      {columns.map((c) => {
                        const value = c[row.key];
                        return (
                          <td
                            key={c.storeId ?? 'combined'}
                            className={`cash-summary__amount${c.storeId === null ? ' cash-summary__combined' : ''}${
                              row.variance ? varianceClass(value) : ''}`}
                          >
                            {value === null ? '—' : row.variance ? formatVariance(value) : formatCurrency(value)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="cash-summary__footnote">
              Negative variance is a shortage, positive is an overage.
              {scope === 'super-admin' && ' Combined adds up every store that recorded cash this month.'}
            </p>
          </>
        )}
      </section>
    </div>
  );
}

export default MonthlyCashSummary;
