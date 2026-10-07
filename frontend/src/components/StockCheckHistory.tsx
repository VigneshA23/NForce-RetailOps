import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Pencil } from 'lucide-react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import Pagination from './Pagination';
import SearchInput from './SearchInput';
import Select from './Select';
import FilterClearButton from './FilterClearButton';
import ItemIcon from './ItemIcon';
import ButtonDots from './ButtonDots';
import CorrectStockCheckModal, { type CorrectStockCheckValues } from './CorrectStockCheckModal';
import { correctStockCheck, getStockCheckHistory } from '../api/storeInventory';
import { INVENTORY_ITEM_CATEGORY_OPTIONS } from '../types/storeInventory';
import type { StockCheckResponse, StockCheckSnapshotKey } from '../types/stockCheck';
import { toStockCheckHistoryRowView, type StockCheckHistoryRowView } from '../utils/stockCheckHistoryStatus';
import { daysAgo, formatDateLabel, formatTimeLabel, todayDate } from '../utils/checklistHistoryOptions';
import { buildAndDownloadStockCheckHistoryPdf, buildStockCheckHistoryWorkbook } from '../utils/stockCheckHistoryExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import useDismissablePanel from '../hooks/useDismissablePanel';
import './StockCheckHistory.css';

const PAGE_SIZE = 10;

// The backend's own page-size ceiling (StockCheckService.MAX_PAGE_SIZE) --
// used when fetching every page for export, so that's the fewest possible
// round trips rather than paging at the UI's 10-row page size.
const MAX_EXPORT_PAGE_SIZE = 200;

// DateRangePicker's ALL_TIME preset resolves to `undefined` (no bound) --
// this endpoint requires a bounded range (a missing bound is a 400), so
// ALL_TIME here means "the widest window the 92-day cap allows", not
// literally unbounded.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

// Export needs every record matching the current filters, not just the
// page on screen -- there's no unbounded "give me everything" endpoint (by
// design: a 92-day range times a full item list can be thousands of rows),
// so this pages through at the server's own max page size and concatenates.
async function fetchAllStockCheckHistory(startDate: string, endDate: string): Promise<StockCheckResponse[]> {
  const all: StockCheckResponse[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const result = await getStockCheckHistory(startDate, endDate, page, MAX_EXPORT_PAGE_SIZE);
    all.push(...result.items);
    pageCount = result.pageCount;
    page += 1;
  } while (page <= pageCount);
  return all;
}

type StatusFilter = 'all' | 'shortage' | 'sufficient';

// Shared by the on-screen table (visibleItems below) and the export path, so
// "export everything the current filters match" can't drift from what the
// table itself is showing.
function matchesFilters(row: StockCheckHistoryRowView, search: string, categoryFilter: string, statusFilter: StatusFilter): boolean {
  const term = search.trim().toLowerCase();
  const recordedBy = row.endOfDay?.lastUpdatedByName ?? row.startOfDay?.lastUpdatedByName ?? '';
  const matchesSearch =
    !term ||
    row.itemName.toLowerCase().includes(term) ||
    recordedBy.toLowerCase().includes(term);
  const matchesCategory = !categoryFilter || row.category === categoryFilter;
  const matches =
    statusFilter === 'all' ||
    (statusFilter === 'shortage' && row.status === 'shortage') ||
    (statusFilter === 'sufficient' && row.status !== 'shortage');
  return matchesSearch && matchesCategory && matches;
}

const CATEGORY_LABELS = Object.fromEntries(INVENTORY_ITEM_CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

// Deterministic initials-circle color, same 6-variant palette ItemIcon picks
// from, so avatars read as "part of the same system" without duplicating
// UserAvatar (which deliberately uses one fixed color everywhere else).
const AVATAR_VARIANTS = ['primary', 'success', 'warning', 'info', 'purple', 'slate'] as const;

function avatarVariantFor(name: string): (typeof AVATAR_VARIANTS)[number] {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_VARIANTS[Math.abs(hash) % AVATAR_VARIANTS.length];
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function RecordedByAvatar({ name }: { name: string }) {
  return (
    <span className="stock-check-history__avatar" data-variant={avatarVariantFor(name)} aria-hidden="true">
      {initialsFor(name)}
    </span>
  );
}

function QtyNeededBadge({ row }: { row: StockCheckHistoryRowView }) {
  if (row.status === 'shortage') {
    return <span className="badge badge--danger">+{row.deficit} {row.unitOfMeasurement} needed</span>;
  }
  if (row.status === 'pending') {
    return <span className="badge badge--outline">— (Not Counted)</span>;
  }
  // optimal
  return row.buffer && row.buffer > 0
    ? <span className="badge badge--success">— (Optimal)</span>
    : <span className="badge badge--success">0 (Sufficient)</span>;
}

interface StockCheckHistoryProps {
  // Lets the parent show this tab's total record count on its own sub-tab
  // label, the same way the Items sub-tab shows its own item count.
  onTotalChange?: (total: number) => void;
}

// Owner/Admin's stock-check audit trail: each item's daily count, how it
// compares to that day's par, and who recorded it, with a per-row action to
// correct either snapshot. Lives as a sub-view of the Inventory tab,
// alongside the Items card grid.
function StockCheckHistory({ onTotalChange }: StockCheckHistoryProps) {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StockCheckHistoryRowView[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useDismissablePanel({ isOpen: isExportMenuOpen, onClose: () => setIsExportMenuOpen(false), refs: [exportMenuRef] });

  const [correctionTarget, setCorrectionTarget] = useState<{ row: StockCheckHistoryRowView; snapshot: StockCheckSnapshotKey } | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);

  // Changing the range resets to page 1 in the same update so the fetch
  // effect below fires exactly once (not once for the range change and
  // again for the page reset).
  function handleRangeChange(next: DateRangeSelection) {
    setDateRange(next);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    setIsLoading(true);
    setLoadError(null);
    getStockCheckHistory(resolved.startDate, resolved.endDate, page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items.map(toStockCheckHistoryRowView));
        setPageCount(result.pageCount);
        setTotalItems(result.totalItems);
        onTotalChange?.(result.totalItems);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange, page]);

  // 60-second silent refresh of the current page, same pattern (and backing
  // the same real "Auto-Synced" indicator) as the Items tab's own poll. A
  // failed poll keeps the last list rather than surfacing an error.
  useEffect(() => {
    const id = window.setInterval(() => {
      const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
      getStockCheckHistory(resolved.startDate, resolved.endDate, page, PAGE_SIZE)
        .then((result) => {
          setItems(result.items.map(toStockCheckHistoryRowView));
          setPageCount(result.pageCount);
          setTotalItems(result.totalItems);
          onTotalChange?.(result.totalItems);
        })
        .catch(() => {});
    }, 60_000);
    return () => window.clearInterval(id);
  }, [dateRange, page]);

  const distinctCategories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter((c): c is NonNullable<typeof c> => !!c))].sort((a, b) =>
      CATEGORY_LABELS[a].localeCompare(CATEGORY_LABELS[b]),
    ),
    [items],
  );

  const visibleItems = useMemo(
    () => items.filter((row) => matchesFilters(row, search, categoryFilter, statusFilter)),
    [items, search, categoryFilter, statusFilter],
  );

  function clearFilters() {
    setSearch('');
    setCategoryFilter('');
    setStatusFilter('all');
  }

  // Exports every record matching the current filters across ALL pages, not
  // just the page on screen (RTS-316) -- re-fetches the full date range at
  // the server's max page size rather than reusing `items`/`visibleItems`,
  // which only ever hold the current page.
  async function buildExportRows(): Promise<StockCheckHistoryRowView[]> {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    const all = await fetchAllStockCheckHistory(resolved.startDate, resolved.endDate);
    return all
      .map(toStockCheckHistoryRowView)
      .filter((row) => matchesFilters(row, search, categoryFilter, statusFilter));
  }

  async function handleExportExcel() {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    setIsExcelExporting(true);
    try {
      const rows = await buildExportRows();
      const workbook = await buildStockCheckHistoryWorkbook(rows, resolved.startDate, resolved.endDate);
      await downloadWorkbook(`stock-check-history-${resolved.startDate}_to_${resolved.endDate}.xlsx`, workbook);
      setIsExportMenuOpen(false);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsExcelExporting(false);
    }
  }

  async function handleExportPdf() {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    setIsPdfExporting(true);
    try {
      const rows = await buildExportRows();
      await buildAndDownloadStockCheckHistoryPdf(
        rows, resolved.startDate, resolved.endDate, null,
        `stock-check-history-${resolved.startDate}_to_${resolved.endDate}.pdf`,
      );
      setIsExportMenuOpen(false);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsPdfExporting(false);
    }
  }

  // Replaces the corrected row in place with the endpoint's returned (fully
  // updated, including its new edit entry) row -- re-derived through
  // toStockCheckHistoryRowView so its status/deficit badge reflects the
  // corrected count -- instead of refetching the whole page.
  async function handleCorrectSubmit(values: CorrectStockCheckValues) {
    if (!correctionTarget) return;
    const { row, snapshot } = correctionTarget;
    setCorrectionError(null);
    setIsCorrecting(true);
    try {
      const updated = await correctStockCheck(row.id, snapshot, values.available, values.deadStock, values.reason);
      setItems((current) => current.map((item) => (item.id === updated.id ? toStockCheckHistoryRowView(updated) : item)));
      nfToast.success(`"${row.itemName}" count corrected.`);
      setCorrectionTarget(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to correct count';
      setCorrectionError(message);
      nfToast.error(message);
    } finally {
      setIsCorrecting(false);
    }
  }

  return (
    <div className="stock-check-history">
      <div className="stock-check-history__header">
        <h1 className="stock-check-history__title">Stock Check History</h1>
        <div className="stock-check-history__header-actions">
          <DateRangePicker value={dateRange} onChange={handleRangeChange} />
          <div className="stock-check-history__export" ref={exportMenuRef}>
            <button
              type="button"
              className="btn btn--danger"
              disabled={visibleItems.length === 0}
              onClick={() => setIsExportMenuOpen((open) => !open)}
              aria-expanded={isExportMenuOpen}
              aria-haspopup="menu"
            >
              <Download size={14} /> Export <ChevronDown size={13} />
            </button>
            {isExportMenuOpen && (
              <div className="stock-check-history__export-menu" role="menu">
                <button
                  type="button"
                  className="stock-check-history__export-item"
                  role="menuitem"
                  onClick={handleExportExcel}
                  disabled={isExcelExporting || isPdfExporting}
                >
                  {isExcelExporting ? <ButtonDots label="Downloading" /> : (<><FileSpreadsheet size={14} /> Download Excel</>)}
                </button>
                <button
                  type="button"
                  className="stock-check-history__export-item"
                  role="menuitem"
                  onClick={handleExportPdf}
                  disabled={isExcelExporting || isPdfExporting}
                >
                  {isPdfExporting ? <ButtonDots label="Generating" /> : (<><FileText size={14} /> Download PDF</>)}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loadError && <div className="stock-check-history__error">{loadError}</div>}

      <div className="filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by item name or staff name..." variant="filter" />
        </div>
        <Select
          className="filter"
          options={[
            { value: '', label: `All Categories (${distinctCategories.length})` },
            ...distinctCategories.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
          ]}
          value={categoryFilter}
          onChange={setCategoryFilter}
          ariaLabel="Filter by category"
        />
        <FilterClearButton onClick={clearFilters} />
      </div>

      <div className="stock-check-history__status-filters" role="group" aria-label="Filter by status">
        <button
          type="button"
          className={`stock-check-history__status-filter${statusFilter === 'all' ? ' stock-check-history__status-filter--active' : ''}`}
          onClick={() => setStatusFilter('all')}
        >
          All Records ({totalItems})
        </button>
        <button
          type="button"
          className={`stock-check-history__status-filter${statusFilter === 'shortage' ? ' stock-check-history__status-filter--active' : ''}`}
          onClick={() => setStatusFilter('shortage')}
        >
          Shortage
        </button>
        <button
          type="button"
          className={`stock-check-history__status-filter${statusFilter === 'sufficient' ? ' stock-check-history__status-filter--active' : ''}`}
          onClick={() => setStatusFilter('sufficient')}
        >
          Sufficient (Optimal)
        </button>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item &amp; Category</th>
                <th scope="col">Date &amp; Timestamp</th>
                <th scope="col">Count Entered</th>
                <th scope="col">Qty Needed (Par Reconciled)</th>
                <th scope="col">Recorded By</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((row) => {
                const recordedBy = row.endOfDay?.lastUpdatedByName ?? row.startOfDay?.lastUpdatedByName ?? null;
                const recordedAt = row.endOfDay?.lastUpdatedAt ?? row.startOfDay?.lastUpdatedAt ?? null;
                // The latest count an employee actually entered that day --
                // End of Day once reconciled, otherwise whatever Start of Day
                // count is already in (so a morning-only entry still shows up
                // here instead of reading as uncounted). Deliberately NOT the
                // same as row.counted (used for the Qty Needed badge), which
                // stays End-of-Day-only since that's the reconciled figure.
                const countEntered = row.endOfDay?.usable ?? row.startOfDay?.usable ?? null;
                // Correcting defaults to whichever snapshot is actually shown
                // above as "Count Entered" -- the modal's own toggle lets the
                // owner switch to the other one when the row has both.
                const defaultSnapshot: StockCheckSnapshotKey = row.endOfDay ? 'END_OF_DAY' : 'START_OF_DAY';
                const canCorrect = row.startOfDay != null || row.endOfDay != null;
                return (
                  <tr key={row.id}>
                    <td data-label="Item & Category">
                      <div className="stock-check-history__item-cell">
                        <ItemIcon id={row.storeInventoryItemId} name={row.itemName} size="sm" />
                        <div>
                          <div className="stock-check-history__item-name">{row.itemName}</div>
                          {row.category && <div className="stock-check-history__item-category">{CATEGORY_LABELS[row.category]}</div>}
                        </div>
                      </div>
                    </td>
                    <td data-label="Date & Timestamp">
                      <div>{formatDateLabel(row.checkDate)}</div>
                      {recordedAt && <div className="stock-check-history__muted">{formatTimeLabel(recordedAt)}</div>}
                    </td>
                    <td data-label="Count Entered">
                      {countEntered != null ? `${countEntered} ${row.unitOfMeasurement}` : '—'}
                    </td>
                    <td data-label="Qty Needed (Par Reconciled)">
                      <QtyNeededBadge row={row} />
                    </td>
                    <td data-label="Recorded By">
                      {recordedBy ? (
                        <div className="stock-check-history__recorded-by">
                          <RecordedByAvatar name={recordedBy} />
                          {recordedBy}
                        </div>
                      ) : '—'}
                    </td>
                    <td data-label="Actions" className="table-actions-cell">
                      {canCorrect && (
                        <div className="table-row-actions">
                          <button
                            type="button"
                            className="stock-check-history__icon-btn"
                            aria-label={`Correct count for ${row.itemName}`}
                            title="Correct this count"
                            onClick={() => {
                              setCorrectionError(null);
                              setCorrectionTarget({ row, snapshot: defaultSnapshot });
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && !loadError && visibleItems.length === 0 && (
          <div className="table-card__empty">
            {items.length === 0 ? 'No stock checks recorded for the selected range.' : 'No records match your search or filter.'}
          </div>
        )}
        {isLoading && <div className="table-card__empty">Loading...</div>}
      </div>

      <Pagination
        page={page}
        pageCount={pageCount}
        totalItems={totalItems}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        itemLabel="audit records"
      />

      <CorrectStockCheckModal
        isOpen={correctionTarget !== null}
        row={correctionTarget?.row ?? null}
        snapshot={correctionTarget?.snapshot ?? null}
        errorMessage={correctionError}
        isSubmitting={isCorrecting}
        onClose={() => setCorrectionTarget(null)}
        onSubmit={handleCorrectSubmit}
      />
    </div>
  );
}

export default StockCheckHistory;
