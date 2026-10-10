import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText, Pencil } from 'lucide-react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import Pagination from './Pagination';
import SearchInput from './SearchInput';
import Select from './Select';
import SearchableSelect from './SearchableSelect';
import FilterClearButton from './FilterClearButton';
import ItemIcon from './ItemIcon';
import ButtonDots from './ButtonDots';
import CorrectStockCheckModal, { type CorrectStockCheckValues } from './CorrectStockCheckModal';
import { getAllStores } from '../api/superAdminStores';
import { getSuperAdminStockCheckHistory, correctSuperAdminStockCheck } from '../api/superAdminOperations';
import { categoryLabel } from '../types/storeInventory';
import type { SuperAdminStockCheckResponse, StockCheckSnapshotKey } from '../types/stockCheck';
import {
  toSuperAdminStockCheckHistoryRowView,
  type SuperAdminStockCheckHistoryRowView,
} from '../utils/stockCheckHistoryStatus';
import { daysAgo, formatDateLabel, formatTimeLabel, todayDate } from '../utils/checklistHistoryOptions';
import { buildAndDownloadStockCheckHistoryPdf, buildStockCheckHistoryWorkbook } from '../utils/stockCheckHistoryExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import useDismissablePanel from '../hooks/useDismissablePanel';

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

// Export is store-scoped only (disabled on "All Stores") -- same single-store
// shape as Owner/Admin's own export, so storeId here is always non-null.
async function fetchAllSuperAdminStockCheckHistory(storeId: number, startDate: string, endDate: string): Promise<SuperAdminStockCheckResponse[]> {
  const all: SuperAdminStockCheckResponse[] = [];
  let page = 1;
  let pageCount = 1;
  do {
    const result = await getSuperAdminStockCheckHistory(storeId, startDate, endDate, page, MAX_EXPORT_PAGE_SIZE);
    all.push(...result.items);
    pageCount = result.pageCount;
    page += 1;
  } while (page <= pageCount);
  return all;
}

type StatusFilter = 'all' | 'shortage' | 'sufficient';

function matchesFilters(
  row: SuperAdminStockCheckHistoryRowView, search: string, categoryFilter: string, statusFilter: StatusFilter,
): boolean {
  const term = search.trim().toLowerCase();
  const recordedBy = row.endOfDay?.lastUpdatedByName ?? row.startOfDay?.lastUpdatedByName ?? '';
  const matchesSearch =
    !term ||
    row.itemName.toLowerCase().includes(term) ||
    row.storeName.toLowerCase().includes(term) ||
    recordedBy.toLowerCase().includes(term);
  const matchesCategory = !categoryFilter || row.category === categoryFilter;
  const matches =
    statusFilter === 'all' ||
    (statusFilter === 'shortage' && row.status === 'shortage') ||
    (statusFilter === 'sufficient' && row.status !== 'shortage');
  return matchesSearch && matchesCategory && matches;
}

function QtyNeededBadge({ row }: { row: SuperAdminStockCheckHistoryRowView }) {
  if (row.status === 'shortage') {
    return <span className="badge badge--danger">+{row.deficit} {row.unitOfMeasurement} needed</span>;
  }
  if (row.status === 'pending') {
    return <span className="badge badge--outline">— (Not Counted)</span>;
  }
  return row.buffer && row.buffer > 0
    ? <span className="badge badge--success">— (Optimal)</span>
    : <span className="badge badge--success">0 (Sufficient)</span>;
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

// Export is store-scoped only (disabled on "All Stores") -- it needs one
// concrete store the same way Owner/Admin's own export always has one.
function SuperAdminStockCheckHistory({ onTotalChange }: SuperAdminStockCheckHistoryProps) {
  const [stores, setStores] = useState<{ id: number; label: string }[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<number | null>(null);

  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SuperAdminStockCheckHistoryRowView[]>([]);
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

  function handleStoreChange(storeId: number | null) {
    setSelectedStoreId(storeId);
    setPage(1);
  }

  useEffect(() => {
    let cancelled = false;
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange(selectedStoreId);
    setIsLoading(true);
    setLoadError(null);
    getSuperAdminStockCheckHistory(selectedStoreId, resolved.startDate, resolved.endDate, page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items.map(toSuperAdminStockCheckHistoryRowView));
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
  }, [dateRange, page, selectedStoreId]);

  const distinctCategories = useMemo(
    () => [...new Set(items.map((i) => i.category).filter((c): c is NonNullable<typeof c> => !!c))].sort((a, b) =>
      categoryLabel(a).localeCompare(categoryLabel(b)),
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

  // Exports every record matching the current filters for the selected store
  // across ALL pages, not just the page on screen -- same approach as
  // Owner/Admin's own StockCheckHistory (RTS-316). Disabled entirely on "All
  // Stores" (selectedStoreId === null), so this always has a concrete store.
  async function buildExportRows(storeId: number): Promise<SuperAdminStockCheckHistoryRowView[]> {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange(storeId);
    const all = await fetchAllSuperAdminStockCheckHistory(storeId, resolved.startDate, resolved.endDate);
    return all
      .map(toSuperAdminStockCheckHistoryRowView)
      .filter((row) => matchesFilters(row, search, categoryFilter, statusFilter));
  }

  async function handleExportExcel() {
    if (selectedStoreId === null) return;
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange(selectedStoreId);
    setIsExcelExporting(true);
    try {
      const rows = await buildExportRows(selectedStoreId);
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
    if (selectedStoreId === null) return;
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange(selectedStoreId);
    const storeName = stores.find((s) => s.id === selectedStoreId)?.label ?? null;
    setIsPdfExporting(true);
    try {
      const rows = await buildExportRows(selectedStoreId);
      await buildAndDownloadStockCheckHistoryPdf(
        rows, resolved.startDate, resolved.endDate, storeName,
        `stock-check-history-${resolved.startDate}_to_${resolved.endDate}.pdf`,
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
              disabled={selectedStoreId === null || visibleItems.length === 0}
              title={selectedStoreId === null ? 'Select a store to export' : undefined}
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
        <div className="filter">
          <SearchableSelect
            id="super-admin-stock-check-store"
            options={stores}
            selectedIds={selectedStoreId === null ? [] : [selectedStoreId]}
            onChange={(ids) => handleStoreChange(ids[0] ?? null)}
            placeholder="All Stores"
            emptyMessage="No stores found"
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
                {showStoreColumn && <th scope="col">Store</th>}
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
                const countEntered = row.endOfDay?.usable ?? row.startOfDay?.usable ?? null;
                const defaultSnapshot: StockCheckSnapshotKey = row.endOfDay ? 'END_OF_DAY' : 'START_OF_DAY';
                return (
                  <tr key={row.id}>
                    {showStoreColumn && <td data-label="Store">{row.storeName}</td>}
                    <td data-label="Item & Category">
                      <div className="stock-check-history__item-cell">
                        <ItemIcon id={row.storeInventoryItemId} name={row.itemName} size="sm" />
                        <div>
                          <div className="stock-check-history__item-name">{row.itemName}</div>
                          {row.category && <div className="stock-check-history__item-category">{categoryLabel(row.category)}</div>}
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
                    <td data-label="Recorded By">{recordedBy ?? '—'}</td>
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
