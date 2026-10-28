import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Clock3, CircleSlash, Download, FileSpreadsheet, FileText, Pencil, Store as StoreIcon } from 'lucide-react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import Pagination from './Pagination';
import SearchInput from './SearchInput';
import Select from './Select';
import SearchableSelect from './SearchableSelect';
import FilterClearButton from './FilterClearButton';
import ItemIcon from './ItemIcon';
import UserAvatar from './UserAvatar';
import ButtonDots from './ButtonDots';
import CorrectStockCheckModal, { type CorrectStockCheckValues } from './CorrectStockCheckModal';
import { getAllStores } from '../api/superAdminStores';
import { getSuperAdminStockCheckHistory, correctSuperAdminStockCheck } from '../api/superAdminOperations';
import { categoryLabel } from '../types/storeInventory';
import type { SuperAdminStockCheckResponse, StockCheckSnapshotKey, StockCheckStatusCounts } from '../types/stockCheck';
import {
  EMPTY_STATUS_COUNTS,
  statusChoiceToParam,
  toSuperAdminStockCheckHistoryRowView,
  type StockCheckHistoryStatusChoice,
  type SuperAdminStockCheckHistoryRowView,
} from '../utils/stockCheckHistoryStatus';
import { daysAgo, formatDateLabel, formatTimeLabel, todayDate } from '../utils/checklistHistoryOptions';
import { buildAndDownloadStockCheckHistoryPdf, buildStockCheckHistoryWorkbook } from '../utils/stockCheckHistoryExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import useDismissablePanel from '../hooks/useDismissablePanel';
import { getInitials } from '../utils/initials';
import EndOfDaySkippedBadge from './EndOfDaySkippedBadge';
import './StockCheckHistory.css';

const PAGE_SIZE = 10;

// The backend's own page-size ceiling, same constant Owner/Admin's own
// StockCheckHistory.tsx uses for its "fetch every page for export" helper.
const MAX_EXPORT_PAGE_SIZE = 200;

// Per-store range cap matches Owner/Admin's own StockCheckHistory; the
// all-stores cap is the backend's own tighter MAX_DATE_RANGE_DAYS_ALL_STORES
// (31 days) -- this widget just needs *a* fallback when ALL_TIME is picked,
// the backend is the actual source of truth for the limit either way.
function widestAllowedRange(storeId: number | null): { startDate: string; endDate: string } {
  return { startDate: daysAgo(storeId == null ? 30 : 91), endDate: todayDate() };
}

// Export can run store-scoped or across "All Stores" (storeId null) --
// getSuperAdminStockCheckHistory already supports both (see its own
// storeId != null check), same as the on-screen table's own query.
async function fetchAllSuperAdminStockCheckHistory(
  storeId: number | null,
  startDate: string,
  endDate: string,
  statusFilter: StockCheckHistoryStatusChoice,
): Promise<SuperAdminStockCheckResponse[]> {
  const all: SuperAdminStockCheckResponse[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const result = await getSuperAdminStockCheckHistory(storeId, startDate, endDate, page, MAX_EXPORT_PAGE_SIZE, statusChoiceToParam(statusFilter));
    all.push(...result.items);
    pageCount = result.pageCount;
    page += 1;
  } while (page <= pageCount);
  return all;
}

// The status filter is applied server-side (so it covers every page).
function matchesFilters(
  row: SuperAdminStockCheckHistoryRowView, search: string, categoryFilter: string,
): boolean {
  const term = search.trim().toLowerCase();
  const recordedBy = row.endOfDay?.lastUpdatedByName ?? row.startOfDay?.lastUpdatedByName ?? '';
  const matchesSearch =
    !term ||
    row.itemName.toLowerCase().includes(term) ||
    row.storeName.toLowerCase().includes(term) ||
    recordedBy.toLowerCase().includes(term);
  const matchesCategory = !categoryFilter || row.category === categoryFilter;
  return matchesSearch && matchesCategory;
}

function QtyNeededBadge({ row }: { row: SuperAdminStockCheckHistoryRowView }) {
  if (row.status === 'shortage') {
    return <span className="stock-check-history__required stock-check-history__required--shortage">+{row.deficit} {row.unitOfMeasurement}</span>;
  }
  if (row.status === 'skipped') {
    return <EndOfDaySkippedBadge reason={row.endOfDaySkipped?.reason} byName={row.endOfDaySkipped?.byName} className="stock-check-history__required stock-check-history__required--muted" />;
  }
  if (row.status === 'pending') {
    return <span className="stock-check-history__required stock-check-history__required--muted">Not counted</span>;
  }
  return <span className="stock-check-history__required stock-check-history__required--sufficient">Sufficient</span>;
}

// Super Admin's cross-store stock-check audit trail (RTS-305) and correction
// (RTS-306) -- adapted from Owner/Admin's own StockCheckHistory.tsx, same
// table/column shape, CorrectStockCheckModal and Export, but store-scoped via
// a picker (default: every store) instead of hardcoded to the caller's own.
interface SuperAdminStockCheckHistoryProps {
  // Lets the parent show this tab's total record count on its own sub-tab
  // label, same as Owner/Admin's own History sub-tab badge.
  onTotalChange?: (total: number) => void;
}

// Export works for a single store or for "All Stores" (RTS-375) -- when
// exporting across all stores the workbook/PDF gain a Store column so rows
// stay attributable, same as the on-screen table's own showStoreColumn.
function SuperAdminStockCheckHistory({ onTotalChange }: SuperAdminStockCheckHistoryProps) {
  const [stores, setStores] = useState<{ id: number; label: string }[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SuperAdminStockCheckHistoryRowView[]>([]);
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
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useDismissablePanel({ isOpen: isExportMenuOpen, onClose: () => setIsExportMenuOpen(false), refs: [exportMenuRef] });

  const [correctionTarget, setCorrectionTarget] = useState<{ row: SuperAdminStockCheckHistoryRowView; snapshot: StockCheckSnapshotKey } | null>(null);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [isCorrecting, setIsCorrecting] = useState(false);

  useEffect(() => {
    getAllStores()
      .then((all) => setStores(all.map((s) => ({ id: s.storeId, label: s.storeName }))))
      .catch(() => {});
  }, []);

  function handleRangeChange(next: DateRangeSelection) {
    setDateRange(next);
    setPage(1);
  }

  function handleStatusChange(next: StockCheckHistoryStatusChoice) {
    setStatusFilter(next);
    setPage(1);
  }

  function handleStoreChange(storeId: number | null) {
    setSelectedStoreId(storeId);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange(selectedStoreId);
    setIsLoading(true);
    setLoadError(null);
    getSuperAdminStockCheckHistory(selectedStoreId, resolved.startDate, resolved.endDate, page, PAGE_SIZE, statusChoiceToParam(statusFilter))
      .then((result) => {
        if (cancelled) return;
        setItems(result.items.map(toSuperAdminStockCheckHistoryRowView));
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
  }, [dateRange, page, selectedStoreId, statusFilter]);

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
    setStatusFilter('all');
    handleStoreChange(null); // also resets to page 1
  }

  // Exports every record matching the current filters across ALL pages, not
  // just the page on screen -- same approach as Owner/Admin's own
  // StockCheckHistory (RTS-316). storeId null means "All Stores".
  async function buildExportRows(storeId: number | null): Promise<SuperAdminStockCheckHistoryRowView[]> {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange(storeId);
    const all = await fetchAllSuperAdminStockCheckHistory(storeId, resolved.startDate, resolved.endDate, statusFilter);
    return all
      .map(toSuperAdminStockCheckHistoryRowView)
      .filter((row) => matchesFilters(row, search, categoryFilter));
  }

  async function handleExportExcel() {
    if (visibleItems.length === 0) return;
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange(selectedStoreId);
    setIsExcelExporting(true);
    try {
      const rows = await buildExportRows(selectedStoreId);
      const workbook = await buildStockCheckHistoryWorkbook(
        rows, resolved.startDate, resolved.endDate, { includeStore: selectedStoreId === null },
      );
      await downloadWorkbook(`stock-check-history-${resolved.startDate}_to_${resolved.endDate}.xlsx`, workbook);
      setIsExportMenuOpen(false);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsExcelExporting(false);
    }
  }

  async function handleExportPdf() {
    if (visibleItems.length === 0) return;
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange(selectedStoreId);
    const storeName = stores.find((s) => s.id === selectedStoreId)?.label ?? null;
    setIsPdfExporting(true);
    try {
      const rows = await buildExportRows(selectedStoreId);
      await buildAndDownloadStockCheckHistoryPdf(
        rows, resolved.startDate, resolved.endDate, storeName,
        `stock-check-history-${resolved.startDate}_to_${resolved.endDate}.pdf`,
        { includeStore: selectedStoreId === null },
      );
      setIsExportMenuOpen(false);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsPdfExporting(false);
    }
  }

  // Super Admin corrections require a reason (enforced server-side
  // regardless of what the form sends); CorrectStockCheckModal always
  // supplies one from its Reason dropdown, so no special-cased UI is needed
  // here beyond passing the row's own storeId through.
  async function handleCorrectSubmit(values: CorrectStockCheckValues) {
    if (!correctionTarget) return;
    const { row, snapshot } = correctionTarget;
    setCorrectionError(null);
    setIsCorrecting(true);
    try {
      const updated = await correctSuperAdminStockCheck(row.storeId, row.id, snapshot, values.available, values.deadStock, values.reason);
      const updatedRow = toSuperAdminStockCheckHistoryRowView({ storeId: row.storeId, storeName: row.storeName, check: updated });
      setItems((current) => current.map((item) => (item.id === updatedRow.id ? updatedRow : item)));
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

  const showStoreColumn = selectedStoreId === null;

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
              title={visibleItems.length === 0 ? 'No records to export' : undefined}
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

      <div className="filter-bar super-admin-stock-check-history__filter-bar stock-check-history__filter-bar">
        <div className="filter">
          <SearchableSelect
            id="super-admin-stock-check-store"
            options={stores}
            selectedIds={selectedStoreId === null ? [] : [selectedStoreId]}
            onChange={(ids) => handleStoreChange(ids[0] ?? null)}
            placeholder="All Stores"
            emptyMessage="No stores found"
            allOption={{
              label: 'All Stores',
              selected: selectedStoreId === null,
              onToggle: () => handleStoreChange(null),
            }}
          />
        </div>
        <div className="filter filter--search">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by item, store, or staff name..." variant="filter" />
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

      <div className="table-card stock-check-history-table-card stock-check-history-table-card--with-store">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                {showStoreColumn && <th scope="col">Store</th>}
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
                const countEntered = row.endOfDay?.usable ?? row.startOfDay?.usable ?? null;
                const defaultSnapshot: StockCheckSnapshotKey = row.endOfDay ? 'END_OF_DAY' : 'START_OF_DAY';
                return (
                  <tr key={`${row.storeId}-${row.id}`}>
                    <td
                      className={showStoreColumn ? undefined : 'stock-check-history__store-cell--mobile-only'}
                      data-label="Store"
                    >
                      <span className="stock-check-history__store-icon" aria-hidden="true">
                        <StoreIcon size={13} />
                      </span>
                      {row.storeName}
                    </td>
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
                            initials={getInitials(recordedBy)}
                            src={row.endOfDay?.lastUpdatedByAvatarUrl ?? row.startOfDay?.lastUpdatedByAvatarUrl}
                            size={36}
                          />
                          <span className="stock-check-history__recorder-name">{recordedBy}</span>
                        </div>
                      ) : '—'}
                    </td>
                    <td data-label="Actions" className="table-actions-cell">
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

export default SuperAdminStockCheckHistory;
