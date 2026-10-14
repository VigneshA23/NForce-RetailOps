import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, Download, FileSpreadsheet, FileText, Layers, PackageCheck, Truck } from 'lucide-react';
import DateRangePicker, { DEFAULT_DATE_RANGE, resolveDateRange } from './DateRangePicker';
import type { DateRangeSelection } from './DateRangePicker';
import ButtonDots from './ButtonDots';
import StoreAccordionGroup from './StoreAccordionGroup';
import SupplierPurchaseTable from './SupplierPurchaseTable';
import OrderHistoryTable from './OrderHistoryTable';
import Pagination from './Pagination';
import StatCard from './StatCard';
import { getOrderHistoryForStore, getSupplierPurchaseMetrics } from '../api/superAdminOperations';
import type { OrderHistoryEntry, StoreSupplierPurchaseMetric } from '../types/orderList';
import { daysAgo, todayDate } from '../utils/checklistHistoryOptions';
import { buildAndDownloadSupplierPurchaseReportPdf, buildSupplierPurchaseReportWorkbook } from '../utils/supplierPurchaseReportExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import useDismissablePanel from '../hooks/useDismissablePanel';
import './SuperAdminSupplierPurchaseReport.css';

const DETAIL_PAGE_SIZE = 20;

// Same "no unbounded query" convention as the Owner/Admin version and
// StockCheckHistory: ALL_TIME resolves to the widest window the 92-day cap
// allows, rather than sending no bound at all.
function widestAllowedRange(): { startDate: string; endDate: string } {
  return { startDate: daysAgo(91), endDate: todayDate() };
}

interface StoreGroup {
  storeId: number;
  storeName: string;
  rows: StoreSupplierPurchaseMetric[];
}

interface SuperAdminSupplierPurchaseReportProps {
  // SuperAdminOrders.tsx's own page-level store picker (used by Order
  // List/Inventory Counts/End of Day Report too) -- null shows every store's
  // group, a specific id narrows down to just that one. No search/filter
  // container of this report's own; it simply follows that global pick.
  selectedStoreId: number | null;
}

interface DetailTarget {
  storeId: number;
  storeName: string;
  supplierName: string;
}

// Super Admin's cross-store Purchasing Report. The API already returns
// pre-aggregated, flat rows (one per store+supplier); grouping them by
// storeId here is a display concern only, not a recalculation -- each row's
// own orderEntryCount/totalQuantity is used as-is.
function SuperAdminSupplierPurchaseReport({ selectedStoreId }: SuperAdminSupplierPurchaseReportProps) {
  const [dateRange, setDateRange] = useState<DateRangeSelection>(DEFAULT_DATE_RANGE);
  const [rows, setRows] = useState<StoreSupplierPurchaseMetric[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const [isExcelExporting, setIsExcelExporting] = useState(false);
  const [isPdfExporting, setIsPdfExporting] = useState(false);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  useDismissablePanel({ isOpen: isExportMenuOpen, onClose: () => setIsExportMenuOpen(false), refs: [exportMenuRef] });

  // "View Details" on a (store, supplier) row switches this same page to its
  // Detailed view instead of bubbling up to SuperAdminOrders.tsx's Order List
  // sub-tab, which used to drop the date range (no date-filtering concept
  // there). null = Summary is showing.
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [detailPage, setDetailPage] = useState(1);
  const [detailRows, setDetailRows] = useState<OrderHistoryEntry[]>([]);
  const [detailPageCount, setDetailPageCount] = useState(1);
  const [detailTotal, setDetailTotal] = useState(0);
  const [detailAwaiting, setDetailAwaiting] = useState(0);
  const [detailReceived, setDetailReceived] = useState(0);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const resolvedRange = resolveDateRange(dateRange) ?? widestAllowedRange();

  useEffect(() => {
    if (detail === null) return;
    let cancelled = false;
    setIsDetailLoading(true);
    setDetailError(null);
    getOrderHistoryForStore(detail.storeId, resolvedRange.startDate, resolvedRange.endDate, detail.supplierName, detailPage, DETAIL_PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        setDetailRows(result.rows);
        setDetailPageCount(result.totalPages);
        setDetailTotal(result.totalElements);
        setDetailAwaiting(result.awaitingReceiptCount);
        setDetailReceived(result.receivedCount);
      })
      .catch((error: Error) => {
        if (!cancelled) setDetailError(error.message);
      })
      .finally(() => {
        if (!cancelled) setIsDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail, detailPage, resolvedRange.startDate, resolvedRange.endDate]);

  function openDetail(row: StoreSupplierPurchaseMetric) {
    setDetailPage(1);
    setDetail({ storeId: row.storeId, storeName: row.storeName, supplierName: row.supplierName });
  }

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

  const groups = useMemo<StoreGroup[]>(() => {
    const byStore = new Map<number, StoreGroup>();
    for (const row of rows) {
      const group = byStore.get(row.storeId);
      if (group) {
        group.rows.push(row);
      } else {
        byStore.set(row.storeId, { storeId: row.storeId, storeName: row.storeName, rows: [row] });
      }
    }
    return [...byStore.values()].sort((a, b) => a.storeName.localeCompare(b.storeName, undefined, { sensitivity: 'base' }));
  }, [rows]);

  const visibleGroups = useMemo(
    () => (selectedStoreId === null ? groups : groups.filter((group) => group.storeId === selectedStoreId)),
    [groups, selectedStoreId],
  );

  // Every group starts expanded (absent from the map reads as true) --
  // there's no page title anymore, so the store's own name on the
  // accordion header is the first thing visible, immediately on load.
  function toggleExpanded(storeId: number) {
    setExpanded((current) => ({ ...current, [storeId]: !(current[storeId] ?? true) }));
  }

  function toExportRows() {
    return visibleGroups.flatMap((group) =>
      group.rows.map((row) => ({
        storeName: group.storeName,
        supplierName: row.supplierName,
        orderEntryCount: row.orderEntryCount,
        receivedCount: row.receivedCount,
      })),
    );
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

  const hasExportableRows = visibleGroups.length > 0;

  if (detail !== null) {
    return (
      <div className="sa-supplier-purchase-report">
        <div className="sa-supplier-purchase-report__toolbar">
          <button type="button" className="btn btn--secondary" onClick={() => setDetail(null)}>
            <ArrowLeft size={14} /> Back to Summary
          </button>
          <DateRangePicker value={dateRange} onChange={setDateRange} />
        </div>

        <div className="sa-supplier-purchase-report__detail-heading">
          Detailed records for <strong>{detail.supplierName}</strong> at <strong>{detail.storeName}</strong>
        </div>

        {detailError && <div className="sa-supplier-purchase-report__error">{detailError}</div>}

        <div className="stat-card-row">
          <StatCard icon={Layers} label="Total Line Items" value={detailTotal} tone="primary" />
          <StatCard icon={Truck} label="Awaiting Receipt" value={detailAwaiting} tone="warning" />
          <StatCard icon={PackageCheck} label="Received" value={detailReceived} tone="success" />
        </div>

        <OrderHistoryTable rows={detailRows} isLoading={isDetailLoading} />
        <Pagination
          page={detailPage}
          pageCount={detailPageCount}
          totalItems={detailTotal}
          pageSize={DETAIL_PAGE_SIZE}
          onPageChange={setDetailPage}
          itemLabel="records"
        />
      </div>
    );
  }

  return (
    <div className="sa-supplier-purchase-report">

      <div className="sa-supplier-purchase-report__toolbar">
        <DateRangePicker value={dateRange} onChange={setDateRange} />
        <div className="sa-supplier-purchase-report__export" ref={exportMenuRef}>
          <button
            type="button"
            className="btn btn--danger"
            disabled={!hasExportableRows}
            title={hasExportableRows ? undefined : 'Nothing to export'}
            onClick={() => setIsExportMenuOpen((open) => !open)}
            aria-expanded={isExportMenuOpen}
            aria-haspopup="menu"
          >
            <Download size={14} /> Export <ChevronDown size={13} />
          </button>
          {isExportMenuOpen && (
            <div className="sa-supplier-purchase-report__export-menu" role="menu">
              <button
                type="button"
                className="sa-supplier-purchase-report__export-item"
                role="menuitem"
                onClick={handleExportExcel}
                disabled={isExcelExporting || isPdfExporting}
              >
                {isExcelExporting ? <ButtonDots label="Downloading" /> : (<><FileSpreadsheet size={14} /> Download Excel</>)}
              </button>
              <button
                type="button"
                className="sa-supplier-purchase-report__export-item"
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

      {loadError && <div className="sa-supplier-purchase-report__error">{loadError}</div>}

      {isLoading ? (
        <div className="table-card__empty">Loading...</div>
      ) : visibleGroups.length === 0 ? (
        <div className="table-card__empty">No purchasing activity found for the selected date range.</div>
      ) : (
        visibleGroups.map((group) => (
          <StoreAccordionGroup
            key={group.storeId}
            storeName={group.storeName}
            supplierCount={group.rows.length}
            orderCount={group.rows.reduce((sum, row) => sum + row.orderEntryCount, 0)}
            isExpanded={expanded[group.storeId] ?? true}
            onToggle={() => toggleExpanded(group.storeId)}
          >
            <SupplierPurchaseTable rows={group.rows} onViewDetails={openDetail} />
          </StoreAccordionGroup>
        ))
      )}
    </div>
  );
}

export default SuperAdminSupplierPurchaseReport;
