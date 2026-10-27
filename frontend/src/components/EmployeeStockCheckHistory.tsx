import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, CircleSlash, Clock3, Download, FileSpreadsheet, FileText } from 'lucide-react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import Pagination from './Pagination';
import SearchInput from './SearchInput';
import ItemIcon from './ItemIcon';
import UserAvatar from './UserAvatar';
import ButtonDots from './ButtonDots';
import { getEmployeeStockCheckHistory } from '../api/stockChecks';
import type { StockCheckResponse, StockCheckStatusCounts } from '../types/stockCheck';
import {
  EMPTY_STATUS_COUNTS,
  statusChoiceToParam,
  toStockCheckHistoryRowView,
  type StockCheckHistoryRowView,
  type StockCheckHistoryStatusChoice,
} from '../utils/stockCheckHistoryStatus';
import { daysAgo, formatDateLabel, formatTimeLabel, todayDate } from '../utils/checklistHistoryOptions';
import { categoryLabel } from '../types/storeInventory';
import { getInitials } from '../utils/initials';
import { buildAndDownloadStockCheckHistoryPdf, buildStockCheckHistoryWorkbook } from '../utils/stockCheckHistoryExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import useDismissablePanel from '../hooks/useDismissablePanel';
import EndOfDaySkippedBadge from './EndOfDaySkippedBadge';
import './StockCheckHistory.css';
import './EmployeeStockCheckHistory.css';

const PAGE_SIZE = 50;

// Mirrors DateRangePicker's ALL_TIME -> the widest window the 92-day cap
// this endpoint enforces allows, since a missing bound is a 400 here.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

function QtyNeededBadge({ row }: { row: StockCheckHistoryRowView }) {
  if (row.status === 'shortage') {
    return <span className="badge badge--danger">+{row.deficit} {row.unitOfMeasurement} needed</span>;
  }
  if (row.status === 'skipped') {
    return <EndOfDaySkippedBadge reason={row.endOfDaySkipped?.reason} byName={row.endOfDaySkipped?.byName} />;
  }
  if (row.status === 'pending') {
    return <span className="badge badge--outline">— (Not Counted)</span>;
  }
  return <span className="badge badge--success">Sufficient</span>;
}

interface EmployeeStockCheckHistoryProps {
  storeId: number;
  // Lets the parent show this page's total record count on its "Stock Check
  // History" tab, the same way it shows today's item count on "Daily Stock
  // Entry".
  onTotalChange?: (total: number) => void;
}

// Employee-facing Stock Check History: a read-only, per-item-per-day audit
// list for one of the caller's assigned stores (GET /me/inventory/stock-checks),
// styled as cards rather than Owner/Admin's table (components/StockCheckHistory.tsx)
// since this is a different audience reviewing one store's own par variances,
// not an owner scanning many rows at once.
function EmployeeStockCheckHistory({ storeId, onTotalChange }: EmployeeStockCheckHistoryProps) {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<StockCheckResponse[]>([]);
  const [pageCount, setPageCount] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [statusCounts, setStatusCounts] = useState<StockCheckStatusCounts>(EMPTY_STATUS_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StockCheckHistoryStatusChoice>('all');
  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useDismissablePanel({
    isOpen: isExportMenuOpen,
    onClose: () => setIsExportMenuOpen(false),
    refs: [exportMenuRef],
  });

  function handleRangeChange(next: DateRangeSelection) {
    setDateRange(next);
    setPage(1);
  }

  // Applied server-side, so it filters every page rather than just this one.
  function handleStatusChange(next: StockCheckHistoryStatusChoice) {
    setStatusFilter(next);
    setPage(1);
  }

  useEffect(() => {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getEmployeeStockCheckHistory(storeId, resolved.startDate, resolved.endDate, page, PAGE_SIZE, statusChoiceToParam(statusFilter))
      .then((result) => {
        if (cancelled) return;
        setRows(result.items);
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
  }, [storeId, dateRange, page, statusFilter]);

  const viewRows = useMemo(() => rows.map(toStockCheckHistoryRowView), [rows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return viewRows.filter((row) => {
      if (query === '') return true;
      return row.itemName.toLowerCase().includes(query) || row.unitOfMeasurement.toLowerCase().includes(query);
    });
  }, [viewRows, search]);

  // Reuses the same ExcelJS + downloadWorkbook pipeline the daily checklist's
  // own Export menu (ExportMenu.tsx) is built on, styled with the same report
  // palette, rather than a plain CSV -- applied to the currently visible
  // (filtered/paged) rows, same scope the CSV export covered.
  async function handleExportExcel() {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    setIsExcelExporting(true);
    try {
      const workbook = await buildStockCheckHistoryWorkbook(visibleRows, resolved.startDate, resolved.endDate);
      await downloadWorkbook(`stock-check-history-${resolved.startDate}_to_${resolved.endDate}.xlsx`, workbook);
      setIsExportMenuOpen(false);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsExcelExporting(false);
    }
  }

  // Same jsPDF + autoTable pipeline as buildAndDownloadOperationsReportPdf
  // (ExportMenu.tsx's "Export as PDF"), styled identically.
  async function handleExportPdf() {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    setIsPdfExporting(true);
    try {
      await buildAndDownloadStockCheckHistoryPdf(
        visibleRows, resolved.startDate, resolved.endDate, null,
        `stock-check-history-${resolved.startDate}_to_${resolved.endDate}.pdf`,
      );
      setIsExportMenuOpen(false);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsPdfExporting(false);
    }
  }

  return (
    <div className="employee-stock-history">
      <div className="employee-stock-check-page__header">
        <div>
          <h1 className="employee-stock-check-page__title">Stock Check History</h1>
          <p className="employee-stock-check-page__subtitle">
            Audit records across dates. Select any daily audit session to inspect par variances and automated replenishment.
          </p>
        </div>
        <div className="employee-stock-history__header-actions">
          <DateRangePicker value={dateRange} onChange={handleRangeChange} />
          <div ref={exportMenuRef} className="employee-stock-history__export">
            <button
              type="button"
              className="btn btn--danger employee-stock-history__export-trigger"
              disabled={visibleRows.length === 0}
              onClick={() => setIsExportMenuOpen((v) => !v)}
              aria-expanded={isExportMenuOpen}
              aria-haspopup="menu"
            >
              <Download size={16} />
              Export
              <ChevronDown size={13} />
            </button>

            {isExportMenuOpen && (
              <div className="employee-stock-history__export-menu" role="menu">
                <button
                  type="button"
                  className="employee-stock-history__export-item"
                  role="menuitem"
                  onClick={handleExportExcel}
                  disabled={isExcelExporting || isPdfExporting}
                >
                  {isExcelExporting ? <ButtonDots label="Downloading" /> : (<><FileSpreadsheet size={14} />Download Excel</>)}
                </button>
                <button
                  type="button"
                  className="employee-stock-history__export-item"
                  role="menuitem"
                  onClick={handleExportPdf}
                  disabled={isExcelExporting || isPdfExporting}
                >
                  {isPdfExporting ? <ButtonDots label="Generating" /> : (<><FileText size={14} />Download PDF</>)}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loadError && (
        <div className="employee-stock-check-page__error">
          {loadError}
        </div>
      )}

      {!loadError && (
        <div className="employee-stock-check-page__toolbar">
          <div className="employee-stock-check-page__toolbar-row">
            <div className="filter--search employee-stock-check-page__search">
              <SearchInput variant="filter" value={search} onChange={setSearch} placeholder="Search stock items..." />
            </div>
            <div className="employee-stock-check-page__filters" role="group" aria-label="Filter by status">
              <button
                type="button"
                className={`employee-stock-check-page__filter-pill${statusFilter === 'all' ? ' employee-stock-check-page__filter-pill--active' : ''}`}
                onClick={() => handleStatusChange('all')}
              >
                All Records ({statusCounts.all})
              </button>
              <button
                type="button"
                className={`employee-stock-history__filter-pill employee-stock-history__filter-pill--shortage${statusFilter === 'shortage' ? ' employee-stock-history__filter-pill--active' : ''}`}
                onClick={() => handleStatusChange('shortage')}
              >
                <AlertTriangle size={13} />
                Shortage ({statusCounts.shortage})
              </button>
              <button
                type="button"
                className={`employee-stock-history__filter-pill employee-stock-history__filter-pill--sufficient${statusFilter === 'sufficient' ? ' employee-stock-history__filter-pill--active' : ''}`}
                onClick={() => handleStatusChange('sufficient')}
              >
                <CheckCircle2 size={13} />
                Sufficient ({statusCounts.sufficient})
              </button>
              <button
                type="button"
                className={`employee-stock-history__filter-pill${statusFilter === 'not_counted' ? ' employee-stock-history__filter-pill--active' : ''}`}
                onClick={() => handleStatusChange('not_counted')}
              >
                <CircleSlash size={13} />
                Not Counted ({statusCounts.notCounted})
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="table-card stock-check-history-table-card employee-stock-history__table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item &amp; Category</th>
                <th scope="col">Date &amp; Timestamp</th>
                <th scope="col">Count Entered</th>
                <th scope="col">Qty Needed (Par Reconciled)</th>
                <th scope="col">Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const recordedBy = row.endOfDay?.lastUpdatedByName ?? row.startOfDay?.lastUpdatedByName ?? null;
                const recordedAt = row.endOfDay?.lastUpdatedAt ?? row.startOfDay?.lastUpdatedAt ?? null;
                const countEntered = row.endOfDay?.usable ?? row.startOfDay?.usable ?? null;
                return (
                  <tr key={row.id}>
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
                    <td data-label="Qty Needed (Par Reconciled)">
                      <div className="stock-check-history__metric">
                        <span className="stock-check-history__metric-label">Qty Needed (Par)</span>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && !loadError && visibleRows.length === 0 && (
          <div className="table-card__empty">
            {rows.length === 0 ? 'No stock checks recorded for the selected range.' : 'No records match your search or filter.'}
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
        itemLabel="stock checks"
      />
    </div>
  );
}

export default EmployeeStockCheckHistory;
