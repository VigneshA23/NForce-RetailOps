import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Download, FileSpreadsheet, FileText } from 'lucide-react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import ButtonDots from './ButtonDots';
import StoreAccordionGroup from './StoreAccordionGroup';
import SupplierPurchaseTable from './SupplierPurchaseTable';
import { getSupplierPurchaseMetrics } from '../api/orderList';
import type { SupplierPurchaseMetric } from '../types/orderList';
import { daysAgo, todayDate } from '../utils/checklistHistoryOptions';
import { buildAndDownloadSupplierPurchaseReportPdf, buildSupplierPurchaseReportWorkbook } from '../utils/supplierPurchaseReportExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import useDismissablePanel from '../hooks/useDismissablePanel';
import './SupplierPurchaseReport.css';

// DateRangePicker's ALL_TIME preset resolves to `undefined` (no bound) --
// this endpoint requires a bounded range (a missing bound is a 400), so
// ALL_TIME here means "the widest window the 92-day cap allows", same
// convention as StockCheckHistory.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

interface SupplierPurchaseReportProps {
  // The store this report is scoped to -- single, server-derived, never sent
  // by this component itself. Purely a display label for the one accordion
  // header; falls back to a generic label if not yet loaded by the caller.
  storeName?: string | null;
  // Switches OrderDashboard's own sub-tab to Order List with this supplier
  // seeded -- see handleViewPurchaseDetails in OrderDashboard.tsx. The date
  // range is accepted for signature parity with Super Admin's own callback
  // but is not carried further: Order List has no date-filtering concept.
  onViewDetails?: (supplierName: string, range: { startDate: string; endDate: string }) => void;
}

// Owner/Admin's own Purchasing Report -- same UI as Super Admin's (one
// StoreAccordionGroup wrapping a SupplierPurchaseTable), just a single,
// always-one-store group rather than a cross-store list, since there's only
// one store to filter by in the first place. Lives as a sub-view of the
// Orders tab alongside Order List, Inventory Counts and End of Day Report.
// The store is never sent by this component -- the backend derives it from
// the authenticated owner.
function SupplierPurchaseReport({ storeName, onViewDetails }: SupplierPurchaseReportProps) {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [rows, setRows] = useState<SupplierPurchaseMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Starts expanded -- there's no page title anymore, so the store's own
  // name on the accordion header is the first thing visible, immediately.
  const [isExpanded, setIsExpanded] = useState(true);

  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useDismissablePanel({ isOpen: isExportMenuOpen, onClose: () => setIsExportMenuOpen(false), refs: [exportMenuRef] });

  const resolvedRange = resolveDateRange(dateRange) ?? widestAllowedRange();
  const displayStoreName = storeName ?? 'My Store';

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getSupplierPurchaseMetrics(resolvedRange.startDate, resolvedRange.endDate)
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((error: Error) => {
        if (!cancelled) setLoadError(error.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateRange]);

  function toExportRows() {
    return rows.map((row) => ({
      storeName: displayStoreName,
      supplierName: row.supplierName,
      orderEntryCount: row.orderEntryCount,
      totalQuantity: row.totalQuantity,
    }));
  }

  async function handleExportExcel() {
    setIsExcelExporting(true);
    try {
      const workbook = await buildSupplierPurchaseReportWorkbook(toExportRows(), resolvedRange.startDate, resolvedRange.endDate);
      await downloadWorkbook(`supplier-purchasing-report-${resolvedRange.startDate}_to_${resolvedRange.endDate}.xlsx`, workbook);
      setIsExportMenuOpen(false);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsExcelExporting(false);
    }
  }

  async function handleExportPdf() {
    setIsPdfExporting(true);
    try {
      await buildAndDownloadSupplierPurchaseReportPdf(
        toExportRows(), resolvedRange.startDate, resolvedRange.endDate,
        `supplier-purchasing-report-${resolvedRange.startDate}_to_${resolvedRange.endDate}.pdf`,
      );
      setIsExportMenuOpen(false);
    } catch (error) {
      nfToast.error(error instanceof Error ? error.message : 'Export failed. Please try again.');
    } finally {
      setIsPdfExporting(false);
    }
  }

  return (
    <div className="supplier-purchase-report">

      <div className="supplier-purchase-report__toolbar">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div className="supplier-purchase-report__export" ref={exportMenuRef}>
          <button
            type="button"
            className="btn btn--danger"
            disabled={rows.length === 0}
            title={rows.length === 0 ? 'Nothing to export' : undefined}
            onClick={() => setIsExportMenuOpen((open) => !open)}
            aria-expanded={isExportMenuOpen}
            aria-haspopup="menu"
          >
            <Download size={14} /> Export <ChevronDown size={13} />
          </button>
          {isExportMenuOpen && (
            <div className="supplier-purchase-report__export-menu" role="menu">
              <button
                type="button"
                className="supplier-purchase-report__export-item"
                role="menuitem"
                onClick={handleExportExcel}
                disabled={isExcelExporting || isPdfExporting}
              >
                {isExcelExporting ? <ButtonDots label="Downloading" /> : (<><FileSpreadsheet size={14} /> Download Excel</>)}
              </button>
              <button
                type="button"
                className="supplier-purchase-report__export-item"
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

      {loadError && <div className="supplier-purchase-report__error">{loadError}</div>}

      {isLoading ? (
        <div className="table-card__empty">Loading...</div>
      ) : rows.length === 0 ? (
        <div className="table-card__empty">No purchasing activity found for the selected date range.</div>
      ) : (
        <StoreAccordionGroup
          storeName={displayStoreName}
          supplierCount={rows.length}
          orderCount={rows.reduce((sum, row) => sum + row.orderEntryCount, 0)}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded((v) => !v)}
        >
          <SupplierPurchaseTable
            rows={rows}
            onViewDetails={onViewDetails && ((row: SupplierPurchaseMetric) => onViewDetails(row.supplierName, resolvedRange))}
          />
        </StoreAccordionGroup>
      )}
    </div>
  );
}

export default SupplierPurchaseReport;
