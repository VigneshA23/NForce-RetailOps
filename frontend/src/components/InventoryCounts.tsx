import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, Clock, Package, Pencil, TrendingDown, XCircle } from 'lucide-react';
import { getInventoryCountHistory, getInventoryCounts, correctStockCheck } from '../api/storeInventory';
import type {
  InventoryCountHistoryEntry,
  InventoryCountRow,
  InventoryCountStatus,
  InventoryItemCategory,
} from '../types/storeInventory';
import { INVENTORY_ITEM_CATEGORY_OPTIONS } from '../types/storeInventory';
import { nfToast } from '../utils/toast';
import { formatDateLabel, formatTimeLabel } from '../utils/checklistHistoryOptions';
import GradientKpiTile from './GradientKpiTile';
import CategoryIcon from './CategoryIcon';
import SearchInput from './SearchInput';
import Select from './Select';
import FilterClearButton from './FilterClearButton';
import Pagination from './Pagination';
import EditInventoryCountModal, { type EditInventoryCountValues } from './EditInventoryCountModal';
import './InventoryCounts.css';

const PAGE_SIZE = 10;

type LevelFilter = 'all' | 'out' | 'low' | 'stale';

const STATUS_META: Record<InventoryCountStatus, { label: string; fg: string; bg: string; dot: string }> = {
  OUT_OF_STOCK: { label: 'Out of Stock', fg: '#b3162a', bg: '#fde8ea', dot: '#e11d33' },
  LOW: { label: 'Below Minimum', fg: '#a3620a', bg: '#fdf1de', dot: '#f59e0b' },
  STALE: { label: 'Not Updated Today', fg: '#52525b', bg: '#f1f1f4', dot: '#a1a1aa' },
  HEALTHY: { label: 'Healthy', fg: '#15803d', bg: '#e3f6ea', dot: '#16a34a' },
};

function InventoryCounts() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<InventoryItemCategory | 'ALL'>('ALL');
  const [level, setLevel] = useState<LevelFilter>('all');
  const [page, setPage] = useState(1);

  const [rows, setRows] = useState<InventoryCountRow[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [kpis, setKpis] = useState({ all: 0, out: 0, low: 0, stale: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [expandedItemId, setExpandedItemId] = useState<number | null>(null);
  const [historyByItemId, setHistoryByItemId] = useState<Record<number, InventoryCountHistoryEntry[]>>({});
  const [historyLoadingId, setHistoryLoadingId] = useState<number | null>(null);

  const [editTarget, setEditTarget] = useState<InventoryCountRow | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // reloadNonce lets the post-edit refresh and the Retry button re-run this
  // exact fetch without duplicating its body -- bumping it re-triggers the
  // effect without changing any actual filter.
  const [reloadNonce, setReloadNonce] = useState(0);
  function load() {
    setReloadNonce((current) => current + 1);
  }

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getInventoryCounts({
      search: search.trim() || undefined,
      category: category === 'ALL' ? undefined : category,
      level: level === 'all' ? undefined : level,
      page,
      size: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setRows(result.rows);
        setPageCount(result.totalPages);
        setTotalItems(result.totalElements);
        setKpis({ all: result.allCount, out: result.outCount, low: result.lowCount, stale: result.staleCount });
      })
      .catch((error: Error) => {
        if (cancelled) return;
        setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [search, category, level, page, reloadNonce]);

  function pickLevel(next: LevelFilter) {
    setLevel((current) => (current === next ? 'all' : next));
    setPage(1);
  }

  function toggleHistory(row: InventoryCountRow) {
    const next = expandedItemId === row.itemId ? null : row.itemId;
    setExpandedItemId(next);
    if (next != null && !historyByItemId[next]) {
      setHistoryLoadingId(next);
      getInventoryCountHistory(next)
        .then((entries) => setHistoryByItemId((current) => ({ ...current, [next]: entries })))
        .catch((error: Error) => nfToast.error(error.message))
        .finally(() => setHistoryLoadingId(null));
    }
  }

  async function handleEditSubmit(values: EditInventoryCountValues) {
    if (!editTarget || editTarget.latestCheckId == null || editTarget.latestSnapshot == null) return;
    setEditError(null);
    setIsEditSubmitting(true);
    try {
      await correctStockCheck(
        editTarget.latestCheckId,
        editTarget.latestSnapshot,
        values.available,
        editTarget.latestDeadStock ?? 0,
        values.reason,
      );
      nfToast.success(`"${editTarget.name}" count updated.`);
      setEditTarget(null);
      // Clears any cached timeline for this item so its next expand re-fetches
      // the newly-added entry, then reloads the current page for fresh stock.
      setHistoryByItemId((current) =>
        Object.fromEntries(Object.entries(current).filter(([itemId]) => Number(itemId) !== editTarget.itemId)),
      );
      load();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to update count';
      setEditError(msg);
      nfToast.error(msg);
    } finally {
      setIsEditSubmitting(false);
    }
  }

  const hasActiveFilters = search !== '' || category !== 'ALL' || level !== 'all';
  function clearFilters() {
    setSearch('');
    setCategory('ALL');
    setLevel('all');
    setPage(1);
  }

  if (loadError) {
    return (
      <div className="inventory-counts__error">
        {loadError}
        <button type="button" className="btn btn--secondary" onClick={load}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="inventory-counts">
      <div className="inventory-counts__kpis">
        <GradientKpiTile icon={Package} label="Items tracked" value={kpis.all} color="#1f6fe0" tint="#eaf1fd" iconBg="#dce8fb" onClick={() => pickLevel('all')} active={level === 'all'} />
        <GradientKpiTile icon={XCircle} label="Out of stock" value={kpis.out} color="#e11d33" tint="#fdecef" iconBg="#fde1e5" onClick={() => pickLevel('out')} active={level === 'out'} />
        <GradientKpiTile icon={TrendingDown} label="Below minimum" value={kpis.low} color="#c77a0a" tint="#fdf3e3" iconBg="#fbe9cc" onClick={() => pickLevel('low')} active={level === 'low'} />
        <GradientKpiTile icon={Clock} label="Not updated today" value={kpis.stale} color="#52525b" tint="#f1f1f4" iconBg="#e7e7ea" onClick={() => pickLevel('stale')} active={level === 'stale'} />
      </div>

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search inventory" variant="filter" />
        </div>
        <Select
          className="filter"
          options={[{ value: 'ALL', label: 'All categories' }, ...INVENTORY_ITEM_CATEGORY_OPTIONS]}
          value={category}
          onChange={(value) => { setCategory(value as InventoryItemCategory | 'ALL'); setPage(1); }}
          ariaLabel="Category"
        />
        <Select
          className="filter"
          options={[
            { value: 'all', label: 'All levels' },
            { value: 'out', label: 'Out of stock' },
            { value: 'low', label: 'Below minimum' },
            { value: 'stale', label: 'Not updated today' },
          ]}
          value={level}
          onChange={(value) => { setLevel(value as LevelFilter); setPage(1); }}
          ariaLabel="Stock level"
        />
        {hasActiveFilters && <FilterClearButton onClick={clearFilters} />}
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table inventory-counts__table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Current Stock</th>
                <th scope="col">Minimum</th>
                <th scope="col">Status</th>
                <th scope="col">Last Updated</th>
                <th scope="col">Change</th>
                <th scope="col" className="inventory-counts__actions-header">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const meta = STATUS_META[row.status];
                const isExpanded = expandedItemId === row.itemId;
                const history = historyByItemId[row.itemId];
                return (
                  <Fragment key={row.itemId}>
                    <tr>
                      <td data-label="Item">
                        <div className="inventory-counts__item-cell">
                          <CategoryIcon category={row.category} name={row.name} size={40} />
                          <div>
                            <div className="inventory-counts__item-name">{row.name}</div>
                            <div className="inventory-counts__item-category">
                              {INVENTORY_ITEM_CATEGORY_OPTIONS.find((o) => o.value === row.category)?.label ?? '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Current Stock">
                        {row.currentStock != null ? (
                          <>
                            <span className="inventory-counts__num" style={{ color: row.status === 'HEALTHY' ? '#18181b' : meta.fg }}>{row.currentStock}</span>
                            <span className="inventory-counts__unit"> {row.unitOfMeasurement}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Minimum">
                        {row.minimum != null ? (
                          <>
                            <span className="inventory-counts__num">{row.minimum}</span>
                            <span className="inventory-counts__unit"> {row.unitOfMeasurement}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Status">
                        <span className="inventory-counts__status-pill" style={{ color: meta.fg, background: meta.bg }}>
                          <span className="inventory-counts__status-dot" style={{ background: meta.dot }} />
                          {meta.label}
                        </span>
                      </td>
                      <td data-label="Last Updated">
                        {row.lastUpdatedAt ? (
                          <>
                            <span style={{ color: row.status === 'STALE' ? '#a3620a' : '#18181b', fontWeight: 600 }}>{formatTimeLabel(row.lastUpdatedAt)}</span>
                            <span className="inventory-counts__muted"> by {row.lastUpdatedByName}</span>
                          </>
                        ) : (
                          'Never counted'
                        )}
                      </td>
                      <td data-label="Change">
                        {row.change != null ? (
                          <span className={row.change < 0 ? 'inventory-counts__change--down' : 'inventory-counts__change--up'}>
                            {row.change > 0 ? '+' : ''}
                            {row.change}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="table-actions-cell" data-label="Actions">
                        <div className="table-row-actions">
                          <button
                            type="button"
                            className="inventory-counts__icon-btn"
                            aria-label={`Edit count for ${row.name}`}
                            title="Edit count"
                            disabled={row.latestCheckId == null}
                            onClick={() => { setEditError(null); setEditTarget(row); }}
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            type="button"
                            className="inventory-counts__icon-btn"
                            aria-label={`Show count history for ${row.name}`}
                            aria-expanded={isExpanded}
                            onClick={() => toggleHistory(row)}
                          >
                            <ChevronDown size={16} className={isExpanded ? 'inventory-counts__chevron--open' : ''} />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="inventory-counts__history-row">
                        <td colSpan={7}>
                          {historyLoadingId === row.itemId ? (
                            <div className="inventory-counts__history-empty">Loading history...</div>
                          ) : !history || history.length === 0 ? (
                            <div className="inventory-counts__history-empty">No count history yet.</div>
                          ) : (
                            <table className="inventory-counts__history-table">
                              <thead>
                                <tr>
                                  <th scope="col">Updated</th>
                                  <th scope="col">Count</th>
                                  <th scope="col">Change</th>
                                  <th scope="col">Updated by</th>
                                </tr>
                              </thead>
                              <tbody>
                                {history.map((entry, index) => (
                                  <tr key={`${entry.checkDate}-${index}`}>
                                    <td>{formatDateLabel(entry.checkDate)}</td>
                                    <td>
                                      {entry.count} {row.unitOfMeasurement}
                                    </td>
                                    <td>{entry.delta != null ? (entry.delta > 0 ? `+${entry.delta}` : entry.delta) : '—'}</td>
                                    <td>
                                      <span className="inventory-counts__avatar">{entry.updatedByName.slice(0, 2).toUpperCase()}</span>
                                      {entry.updatedByName}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && rows.length === 0 && (
          <div className="inventory-counts__empty">
            {totalItems === 0 && !hasActiveFilters ? 'No inventory items yet.' : 'No items match these filters.'}
          </div>
        )}
        {isLoading && <div className="inventory-counts__empty">Loading...</div>}
      </div>

      <Pagination page={page} pageCount={pageCount} totalItems={totalItems} pageSize={PAGE_SIZE} onPageChange={setPage} itemLabel="items" />

      <EditInventoryCountModal
        isOpen={editTarget !== null}
        row={editTarget}
        errorMessage={editError}
        isSubmitting={isEditSubmitting}
        onClose={() => setEditTarget(null)}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}

export default InventoryCounts;
