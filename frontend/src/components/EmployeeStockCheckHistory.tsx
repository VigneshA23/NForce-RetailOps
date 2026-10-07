import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, Download, FileSpreadsheet, FileText, TrendingDown } from 'lucide-react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import Pagination from './Pagination';
import SearchInput from './SearchInput';
import ItemIcon from './ItemIcon';
import ButtonDots from './ButtonDots';
import { getEmployeeStockCheckHistory } from '../api/stockChecks';
import type { StockCheckResponse } from '../types/stockCheck';
import { toStockCheckHistoryRowView } from '../utils/stockCheckHistoryStatus';
import { daysAgo, formatDateLabel, todayDate } from '../utils/checklistHistoryOptions';
import { buildAndDownloadStockCheckHistoryPdf, buildStockCheckHistoryWorkbook } from '../utils/stockCheckHistoryExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import useDismissablePanel from '../hooks/useDismissablePanel';
import './EmployeeStockCheckHistory.css';

const PAGE_SIZE = 50;

// Mirrors DateRangePicker's ALL_TIME -> the widest window the 92-day cap
// this endpoint enforces allows, since a missing bound is a 400 here.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

type StatusFilter = 'all' | 'shortage' | 'optimal';

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
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
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

  useEffect(() => {
    const resolved = resolveDateRange(dateRange) ?? widestAllowedRange();
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getEmployeeStockCheckHistory(storeId, resolved.startDate, resolved.endDate, page, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setRows(result.items);
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
  }, [storeId, dateRange, page]);

  const viewRows = useMemo(() => rows.map(toStockCheckHistoryRowView), [rows]);

  const shortageCount = useMemo(() => viewRows.filter((r) => r.status === 'shortage').length, [viewRows]);
  const optimalCount = useMemo(() => viewRows.filter((r) => r.status === 'optimal').length, [viewRows]);

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return viewRows.filter((row) => {
      if (statusFilter !== 'all' && row.status !== statusFilter) return false;
      if (query === '') return true;
      return row.itemName.toLowerCase().includes(query) || row.unitOfMeasurement.toLowerCase().includes(query);
    });
  }, [viewRows, search, statusFilter]);

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
                onClick={() => setStatusFilter('all')}
              >
                All Items ({viewRows.length})
              </button>
              <button
                type="button"
                className={`employee-stock-history__filter-pill employee-stock-history__filter-pill--shortage${statusFilter === 'shortage' ? ' employee-stock-history__filter-pill--active' : ''}`}
                onClick={() => setStatusFilter('shortage')}
              >
                <AlertTriangle size={13} />
                Shortage ({shortageCount})
              </button>
              <button
                type="button"
                className={`employee-stock-history__filter-pill employee-stock-history__filter-pill--optimal${statusFilter === 'optimal' ? ' employee-stock-history__filter-pill--active' : ''}`}
                onClick={() => setStatusFilter('optimal')}
              >
                <CheckCircle2 size={13} />
                Optimal ({optimalCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {!isLoading && !loadError && visibleRows.length === 0 && (
        <div className="employee-stock-check-page__empty">
          {rows.length === 0 ? 'No stock checks recorded for the selected range.' : 'No records match your search or filter.'}
        </div>
      )}
      {isLoading && <div className="employee-stock-check-page__empty">Loading...</div>}

      <div className="employee-stock-history__list">
        {visibleRows.map((row) => {
          // Same "whoever last touched End of Day, else Start of Day"
          // derivation Owner/Admin's StockCheckHistory uses for its own
          // "Recorded By" column, so an employee sees the same answer an
          // Admin would for the same row.
          const recordedBy = row.endOfDay?.lastUpdatedByName ?? row.startOfDay?.lastUpdatedByName ?? null;
          return (
            <article
              key={row.id}
              className={`employee-stock-history__item employee-stock-history__item--${row.status}`}
            >
              <ItemIcon id={row.storeInventoryItemId} name={row.itemName} />
              <div className="employee-stock-history__item-main">
                <h3 className="employee-stock-history__item-name">{row.itemName}</h3>
                <p className="employee-stock-history__item-meta">
                  Min Par: {row.requiredPar ?? '—'} {row.unitOfMeasurement} · {formatDateLabel(row.checkDate)}
                  {recordedBy && ` · Recorded by ${recordedBy}`}
                </p>
                {row.status === 'shortage' && (
                  <span className="badge badge--danger employee-stock-history__status">
                    <TrendingDown size={12} /> {row.deficit} {row.unitOfMeasurement} Deficit
                  </span>
                )}
                {row.status === 'optimal' && (
                  <span className="badge badge--success employee-stock-history__status">
                    <CheckCircle2 size={12} /> Optimal (+{row.buffer} Buffer)
                  </span>
                )}
                {row.status === 'pending' && (
                  <span className="badge badge--outline employee-stock-history__status">Not Counted</span>
                )}
                {row.edits.length > 0 && (
                  <span
                    className="badge badge--info employee-stock-history__status"
                    title="An Owner/Admin corrected this count"
                  >
                    Corrected
                  </span>
                )}
              </div>
              <div className="employee-stock-history__stats">
                <div className="employee-stock-history__stat">
                  <span className="employee-stock-history__stat-label">Counted</span>
                  <strong
                    className={
                      row.status === 'shortage'
                        ? 'employee-stock-history__stat-value--danger'
                        : row.status === 'optimal'
                          ? 'employee-stock-history__stat-value--success'
                          : undefined
                    }
                  >
                    {row.counted ?? '—'} {row.unitOfMeasurement}
                  </strong>
                </div>
                <div className="employee-stock-history__stat">
                  <span className="employee-stock-history__stat-label">Required Par</span>
                  <strong>{row.requiredPar ?? '—'} {row.unitOfMeasurement}</strong>
                </div>
              </div>
            </article>
          );
        })}
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
