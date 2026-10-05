import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clipboard } from 'lucide-react';
import CalendarPopover from './CalendarPopover';
import { getEodSupplierReport } from '../api/storeInventory';
import type { EodReportRow, EodReportStatus, EodSupplierReport as EodSupplierReportData } from '../types/stockCheck';
import { formatDateNavLabel, stepDate, todayDate } from '../utils/checklistHistoryOptions';
import { buildEodReportText, usableStock } from '../utils/orderListExport';
import { nfToast } from '../utils/toast';
import './EodSupplierReport.css';

const STATUS_META: Record<EodReportStatus, { label: string; tone: string }> = {
  NEEDS_TO_ORDER: { label: 'Needs to Order', tone: 'danger' },
  SUFFICIENT: { label: 'Sufficient', tone: 'success' },
  END_OF_DAY_PENDING: { label: 'EOD Pending', tone: 'warning' },
  NO_MINIMUM_SET: { label: 'No Minimum Set', tone: 'info' },
};

function value(n: number | null): string {
  return n == null ? '—' : String(n);
}

function DeadCell({ label, deadStock }: { label: string; deadStock: number | null }) {
  return (
    <td data-label={label}>
      <span className={deadStock ? 'eod-report__dead' : undefined}>{value(deadStock)}</span>
    </td>
  );
}

function ReportRow({ row, supplierName }: { row: EodReportRow; supplierName: string }) {
  const status = STATUS_META[row.status];
  return (
    <tr>
      <td data-label="Item">
        {row.itemName}
        <span className="eod-report__unit">{row.unitOfMeasurement}</span>
      </td>
      <td data-label="Supplier">{supplierName}</td>
      <td data-label="Start Usable">{value(usableStock(row.startOfDayAvailable, row.startOfDayDeadStock))}</td>
      <DeadCell label="Start Dead" deadStock={row.startOfDayDeadStock} />
      <td data-label="End Usable">{value(usableStock(row.endOfDayAvailable, row.endOfDayDeadStock))}</td>
      <DeadCell label="End Dead" deadStock={row.endOfDayDeadStock} />
      <td data-label="Used">{value(row.stockUsed)}</td>
      <td data-label="Required Tomorrow">{value(row.requiredTomorrow)}</td>
      <td data-label="Order Qty">
        <strong className={row.quantityToOrder ? 'eod-report__order-qty' : undefined}>{value(row.quantityToOrder)}</strong>
      </td>
      <td data-label="Status">
        <span className={`badge badge--${status.tone}`}>{status.label}</span>
      </td>
    </tr>
  );
}

// Owner/Admin's End of Day supplier report: each item's Start/End of Day
// usable stock (available minus dead) with each snapshot's dead stock in its
// own column, so Start Usable - End Usable = Used reads straight across; usage, tomorrow's requirement and quantity to order for one
// business day, grouped by supplier ("No Supplier" last).
function EodSupplierReport({ storeName }: { storeName?: string | null }) {
  const [date, setDate] = useState(todayDate());
  const [report, setReport] = useState<EodSupplierReportData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const dateTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getEodSupplierReport(date)
      .then((result) => {
        if (!cancelled) setReport(result);
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
  }, [date]);

  const isToday = date >= todayDate();
  const hasItems = (report?.groups.length ?? 0) > 0;

  async function handleCopy() {
    if (!report) return;
    const text = buildEodReportText(report, storeName);
    try {
      await navigator.clipboard.writeText(text);
      nfToast.success('Report copied to clipboard.');
    } catch {
      nfToast.error('Could not copy to clipboard. Please copy manually.');
    }
  }

  return (
    <div className="eod-report">
      <div className="eod-report__toolbar">
        <div className="eod-report__date-nav">
          <button type="button" className="eod-report__date-arrow" onClick={() => setDate(stepDate(date, -1))} aria-label="Previous day">
            <ChevronLeft size={16} />
          </button>
          <button
            ref={dateTriggerRef}
            type="button"
            className="eod-report__date-display"
            onClick={() => setPickerOpen((v) => !v)}
            aria-expanded={pickerOpen}
            aria-label="Pick a date"
          >
            <Calendar size={13} />
            {formatDateNavLabel(date)}
          </button>
          <button
            type="button"
            className="eod-report__date-arrow"
            onClick={() => setDate(stepDate(date, 1))}
            disabled={isToday}
            aria-label="Next day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        {report && !isLoading && (
          <p className="eod-report__summary">
            {report.itemsNeedingOrder} to order · {report.itemsPendingEndOfDay} awaiting End of Day count
          </p>
        )}
        <button type="button" className="btn btn--secondary" onClick={handleCopy} disabled={isLoading || !hasItems}>
          <Clipboard size={16} />
          Copy Report
        </button>
      </div>
      <CalendarPopover
        value={date}
        max={todayDate()}
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={(d) => setDate(d)}
        anchorRef={dateTriggerRef}
      />

      {loadError && <div className="eod-report__error">{loadError}</div>}

      <div className="table-card">
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Supplier</th>
                <th scope="col">Start Usable</th>
                <th scope="col">Start Dead</th>
                <th scope="col">End Usable</th>
                <th scope="col">End Dead</th>
                <th scope="col">Used</th>
                <th scope="col">Required Tomorrow</th>
                <th scope="col">Order Qty</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            {!isLoading && report?.groups.map((group) => (
              <tbody key={group.supplierId ?? 'none'}>
                <tr className="eod-report__group-row">
                  <th scope="rowgroup" colSpan={10}>
                    {group.supplierName}
                    <span className="eod-report__group-count">
                      {group.items.length} item{group.items.length === 1 ? '' : 's'}
                    </span>
                  </th>
                </tr>
                {group.items.map((row) => (
                  <ReportRow key={row.storeInventoryItemId} row={row} supplierName={group.supplierName} />
                ))}
              </tbody>
            ))}
          </table>
        </div>
        {isLoading && <div className="table-card__empty">Loading...</div>}
        {!isLoading && !loadError && !hasItems && (
          <div className="table-card__empty">No inventory items to report for this day.</div>
        )}
      </div>
    </div>
  );
}

export default EodSupplierReport;
