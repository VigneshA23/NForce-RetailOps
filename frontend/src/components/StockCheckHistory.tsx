import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, CircleSlash, Download, FileSpreadsheet, FileText, Pencil, Store as StoreIcon } from 'lucide-react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import Pagination from './Pagination';
import SearchInput from './SearchInput';
import Select from './Select';
import FilterClearButton from './FilterClearButton';
import ItemIcon from './ItemIcon';
import UserAvatar from './UserAvatar';
import ButtonDots from './ButtonDots';
import CorrectStockCheckModal, { type CorrectStockCheckValues } from './CorrectStockCheckModal';
import { correctStockCheck, getStockCheckHistory } from '../api/storeInventory';
import { categoryLabel } from '../types/storeInventory';
import type { StockCheckResponse, StockCheckSnapshotKey, StockCheckStatusCounts } from '../types/stockCheck';
import {
  EMPTY_STATUS_COUNTS,
  statusChoiceToParam,
  toStockCheckHistoryRowView,
  type StockCheckHistoryRowView,
  type StockCheckHistoryStatusChoice,
} from '../utils/stockCheckHistoryStatus';
import { daysAgo, formatDateLabel, formatTimeLabel, todayDate } from '../utils/checklistHistoryOptions';
import { buildAndDownloadStockCheckHistoryPdf, buildStockCheckHistoryWorkbook } from '../utils/stockCheckHistoryExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import EndOfDaySkippedBadge from './EndOfDaySkippedBadge';
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
async function fetchAllStockCheckHistory(
  startDate: string,
  endDate: string,
  statusFilter: StockCheckHistoryStatusChoice,
): Promise<StockCheckResponse[]> {
  const all: StockCheckResponse[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const result = await getStockCheckHistory(startDate, endDate, page, MAX_EXPORT_PAGE_SIZE, statusChoiceToParam(statusFilter));
    all.push(...result.items);
    pageCount = result.pageCount;
    page += 1;
  } while (page <= pageCount);
  return all;
}

// Shared by the on-screen table (visibleItems below) and the export path, so
// "export everything the current filters match" can't drift from what the
// table itself is showing. The status filter is applied server-side (so it
// covers every page), not here.
function matchesFilters(row: StockCheckHistoryRowView, search: string, categoryFilter: string): boolean {
  const term = search.trim().toLowerCase();
  const recordedBy = row.endOfDay?.lastUpdatedByName ?? row.startOfDay?.lastUpdatedByName ?? '';
  const matchesSearch =
    !term ||
    row.itemName.toLowerCase().includes(term) ||
    recordedBy.toLowerCase().includes(term);
  const matchesCategory = !categoryFilter || row.category === categoryFilter;
  return matchesSearch && matchesCategory;
}

function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function QtyNeededBadge({ row }: { row: StockCheckHistoryRowView }) {
  if (row.status === 'shortage') {
    return <span className="stock-check-history__required stock-check-history__required--shortage">+{row.deficit} {row.unitOfMeasurement}</span>;
  }
  if (row.status === 'skipped') {
    return <EndOfDaySkippedBadge reason={row.endOfDaySkipped?.reason} byName={row.endOfDaySkipped?.byName} className="stock-check-history__required stock-check-history__required--muted" />;
  }
  if (row.status === 'pending') {
    return <span className="stock-check-history__required stock-check-history__required--muted">Not counted</span>;
  }
  // optimal
  return <span className="stock-check-history__required stock-check-history__required--sufficient">Sufficient</span>;
}

interface StockCheckHistoryProps {
  storeName?: string | null;
  // Lets the parent show this tab's total record count on its own sub-tab
  // label, the same way the Items sub-tab shows its own item count.
  onTotalChange?: (total: number) => void;
}

// Owner/Admin's stock-check audit trail: each item's daily count, how it
// compares to that day's par, and who recorded it, with a per-row action to
// correct either snapshot. Lives as a sub-view of the Inventory tab,
// alongside the Items card grid.
function StockCheckHistory({ onTotalChange, storeName }: StockCheckHistoryProps) {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<StockCheckHistoryRowView[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StockCheckStatusCounts>(EMPTY_STATUS_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockCheckHistoryStatusChoice>('all');
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);

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

  function handleStatusChange(next: StockCheckHistoryStatusChoice) {
    setStatusFilter(next);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    setIsLoading(true);
    setLoadError(null);
    getStockCheckHistory(resolved.startDate, resolved.endDate, page, PAGE_SIZE, statusChoiceToParam(statusFilter))
      .then((result) => {
        if (cancelled) return;
        setItems(result.items.map(toStockCheckHistoryRowView));
        setPageCount(result.pageCount);
        setTotalItems(result.totalItems);
        setStatusCounts(result.statusCounts);
        onTotalChange?.(result.statusCounts.all);
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
  }, [dateRange, page, statusFilter]);

  // 60-second silent refresh of the current page, same pattern as the Items
  // tab's own poll. A failed poll keeps the last list rather than surfacing
  // an error.
  useEffect(() => {
    const id = window.setInterval(() => {
      const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
      getStockCheckHistory(resolved.startDate, resolved.endDate, page, PAGE_SIZE, statusChoiceToParam(statusFilter))
        .then((result) => {
          setItems(result.items.map(toStockCheckHistoryRowView));
          setPageCount(result.pageCount);
          setTotalItems(result.totalItems);
          setStatusCounts(result.statusCounts);
          onTotalChange?.(result.statusCounts.all);
        })
        .catch(() => {});
    }, 60_000);
    return () => window.clearInterval(id);
  }, [dateRange, page, statusFilter]);

  const distinctCategories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter((c): c is NonNullable<typeof c> => !!c))].sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b)),
    ),
    [items],
  );

  const visibleItems = useMemo(
    () => items.filter((row) => matchesFilters(row, search, categoryFilter)),
    [items, search, categoryFilter],
  );

  function clearFilters() {
    setSearch('');
    setCategoryFilter('');
    handleStatusChange('all');
  }

  // Exports every record matching the current filters across ALL pages, not
  // just the page on screen (RTS-316) -- re-fetches the full date range at
  // the server's max page size rather than reusing `items`/`visibleItems`,
  // which only ever hold the current page.
  async function buildExportRows(): Promise<StockCheckHistoryRowView[]> {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    const all = await fetchAllStockCheckHistory(resolved.startDate, resolved.endDate, statusFilter);
    return all
      .map(toStockCheckHistoryRowView)
      .filter((row) => matchesFilters(row, search, categoryFilter));
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
          <div className="stock-check-history__export">
            <DropdownMenu open={isExportMenuOpen} onOpenChange={setIsExportMenuOpen}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="btn btn--danger" disabled={visibleItems.length === 0}>
                  <Download size={14} /> Export <ChevronDown size={13} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                sideOffset={4}
                collisionPadding={8}
                className="stock-check-history__export-menu w-auto border-none bg-transparent p-0 shadow-none"
              >
                <DropdownMenuItem
                  className="stock-check-history__export-item"
                  onSelect={(event) => {
                    event.preventDefault();
                    handleExportExcel();
                  }}
                  disabled={isExcelExporting || isPdfExporting}
                >
                  {isExcelExporting ? <ButtonDots label="Downloading" /> : (<><FileSpreadsheet size={14} /> Download Excel</>)}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="stock-check-history__export-item"
                  onSelect={(event) => {
                    event.preventDefault();
                    handleExportPdf();
                  }}
                  disabled={isExcelExporting || isPdfExporting}
                >
                  {isPdfExporting ? <ButtonDots label="Generating" /> : (<><FileText size={14} /> Download PDF</>)}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {loadError && <div className="stock-check-history__error">{loadError}</div>}

      <div className="filter-bar stock-check-history__filter-bar">
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by item name or staff name..." variant="filter" />
        </div>
        <Select
          className="filter"
          options={[
            { value: '', label: `All Categories (${distinctCategories.length})` },
            ...distinctCategories.map((c) => ({ value: c, label: categoryLabel(c) })),
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
          onClick={() => handleStatusChange('all')}
        >
          All Records ({statusCounts.all})
        </button>
        <button
          type="button"
          className={`stock-check-history__status-filter stock-check-history__status-filter--shortage${statusFilter === 'shortage' ? ' stock-check-history__status-filter--active' : ''}`}
          onClick={() => handleStatusChange('shortage')}
        >
          <AlertTriangle size={13} />
          Shortage ({statusCounts.shortage})
        </button>
        <button
          type="button"
          className={`stock-check-history__status-filter stock-check-history__status-filter--sufficient${statusFilter === 'sufficient' ? ' stock-check-history__status-filter--active' : ''}`}
          onClick={() => handleStatusChange('sufficient')}
        >
          <CheckCircle2 size={13} />
          Sufficient ({statusCounts.sufficient})
        </button>
        <button
          type="button"
          className={`stock-check-history__status-filter stock-check-history__status-filter--not-counted${statusFilter === 'not_counted' ? ' stock-check-history__status-filter--active' : ''}`}
          onClick={() => handleStatusChange('not_counted')}
        >
          <CircleSlash size={13} />
          Not Counted ({statusCounts.notCounted})
        </button>
      </div>

      <div className={`table-card stock-check-history-table-card${storeName ? ' stock-check-history-table-card--with-store' : ''}`}>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item &amp; Category</th>
                <th scope="col">Date &amp; Timestamp</th>
                <th scope="col">Count Entered</th>
                <th scope="col">Required</th>
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
                    {storeName && (
                      <td className="stock-check-history__store-cell--mobile-only" data-label="Store">
                        <span className="stock-check-history__store-icon" aria-hidden="true">
                          <StoreIcon size={13} />
                        </span>
                        {storeName}
                      </td>
                    )}
                    <td data-label="Item & Category">
                      <div className="stock-check-history__item-cell">
                        <ItemIcon id={row.storeInventoryItemId} name={row.itemName} size="md" imageId={row.imageId} />
                        <div>
                          <div className="stock-check-history__item-name">{row.itemName}</div>
                          {row.category && (
                            <div className="stock-check-history__item-category">{categoryLabel(row.category)}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td data-label="Date & Timestamp">
                      <div className="stock-check-history__timestamp">
                        <Clock3 size={14} aria-hidden="true" />
                        <span>{formatDateLabel(row.checkDate)}</span>
                        {recordedAt && (
                          <>
                            <span className="stock-check-history__timestamp-separator" aria-hidden="true">·</span>
                            <span className="stock-check-history__timestamp-time">{formatTimeLabel(recordedAt)}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td data-label="Count Entered">
                      <div className="stock-check-history__metric">
                        <span className="stock-check-history__metric-label">Count Entered</span>
                        <span>{countEntered != null ? `${countEntered} ${row.unitOfMeasurement}` : '—'}</span>
                      </div>
                    </td>
                    <td data-label="Required">
                      <div className="stock-check-history__metric">
                        <span className="stock-check-history__metric-label">Required</span>
                        <QtyNeededBadge row={row} />
                      </div>
                    </td>
                    <td data-label="Recorded By">
                      {recordedBy ? (
                        <div className="stock-check-history__recorded-by">
                          <UserAvatar
                            initials={initialsFor(recordedBy)}
                            src={row.endOfDay?.lastUpdatedByAvatarUrl ?? row.startOfDay?.lastUpdatedByAvatarUrl}
                            size={36}
                          />
                          <span className="stock-check-history__recorder-name">{recordedBy}</span>
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
