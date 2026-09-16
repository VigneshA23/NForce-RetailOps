import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, Download, FileDown, FileSpreadsheet, FileText } from 'lucide-react';
import CalendarPopover from './CalendarPopover';
import { getChecklistHistoryOperationsReport } from '../api/checklistHistory';
import { buildOperationsReportWorkbook, summarizeByStore } from '../utils/operationsReportExport';
import { buildAndDownloadOperationsReportPdf } from '../utils/operationsReportPdfExport';
import { downloadWorkbook } from '../utils/xlsx';
import { MAX_RANGE_DAYS, todayDate } from '../utils/checklistHistoryOptions';
import './ExportMenu.css';

interface ExportMenuProps {
  storeId: number | null;
  date: string;
  storeName?: string | null;
}

type ExportFormat = 'excel' | 'pdf';

// Shared by the single-day and date-range PDF exports -- deliberately a richer,
// more human subtitle style (weekday spelled out) than Excel's own formatLongDate,
// which this file has never matched exactly since the two exports' headers were
// designed independently.
function formatPdfDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// Numeric DD-MM-YYYY display for the Date Range fields -- distinct from the
// weekday-spelled-out label above and from the nav header's formatDateNavLabel,
// neither of which match this panel's compact field style.
function formatRangeDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

// Shared by both the Excel and PDF range exports.
function validateRange(rangeStart: string, rangeEnd: string): string | null {
  if (rangeStart > rangeEnd) return 'Start date must be on or before end date.';
  const days = (new Date(`${rangeEnd}T00:00:00`).getTime() - new Date(`${rangeStart}T00:00:00`).getTime()) / 86_400_000;
  if (days > MAX_RANGE_DAYS) return `Max ${MAX_RANGE_DAYS} days.`;
  return null;
}

function ExportMenu({ storeId, date, storeName }: ExportMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>('excel');
  const [rangeStart, setRangeStart] = useState(date);
  const [rangeEnd, setRangeEnd] = useState(date);
  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);
  const [rangeExporting, setRangeExporting] = useState(false);
  const [pdfRangeExporting, setPdfRangeExporting] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fromTriggerRef = useRef<HTMLButtonElement>(null);
  const toTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setRangeStart(date);
    setRangeEnd(date);
  }, [date]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setRangeError(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  async function handleExportRange() {
    const validationError = validateRange(rangeStart, rangeEnd);
    setRangeError(validationError);
    if (validationError) return;
    setRangeExporting(true);
    try {
      const report = await getChecklistHistoryOperationsReport({ startDate: rangeStart, endDate: rangeEnd, storeId: storeId ?? undefined });
      const summary = summarizeByStore(report.summary);
      const workbook = await buildOperationsReportWorkbook(summary, report.details, rangeStart, rangeEnd);
      await downloadWorkbook(`checklist-${rangeStart}_to_${rangeEnd}.xlsx`, workbook);
      setMenuOpen(false);
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setRangeExporting(false);
    }
  }

  async function handleExportPdfRange() {
    const validationError = validateRange(rangeStart, rangeEnd);
    setRangeError(validationError);
    if (validationError) return;
    setPdfRangeExporting(true);
    try {
      const report = await getChecklistHistoryOperationsReport({ startDate: rangeStart, endDate: rangeEnd, storeId: storeId ?? undefined });
      const summary = summarizeByStore(report.summary);
      const storeEntry = summary[0];
      await buildAndDownloadOperationsReportPdf({
        title: storeName ?? storeEntry?.storeName ?? 'Store',
        dateLabel: rangeStart === rangeEnd
          ? formatPdfDateLabel(rangeStart)
          : `${formatPdfDateLabel(rangeStart)} – ${formatPdfDateLabel(rangeEnd)}`,
        scheduled: storeEntry?.scheduled ?? 0,
        completed: storeEntry?.completed ?? 0,
        issues: storeEntry?.issues ?? 0,
        details: report.details,
        filename: `checklist-${rangeStart}_to_${rangeEnd}.pdf`,
      });
      setMenuOpen(false);
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setPdfRangeExporting(false);
    }
  }

  function handleDownload() {
    return format === 'excel' ? handleExportRange() : handleExportPdfRange();
  }

  const downloading = rangeExporting || pdfRangeExporting;

  return (
    <div ref={menuRef} className="export-menu">
      <button
        type="button"
        className="btn btn--danger export-menu__trigger"
        onClick={() => { setMenuOpen((v) => !v); setRangeError(null); }}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        <Download size={14} />
        Export
        <ChevronDown size={13} />
      </button>

      {menuOpen && (
        <div className="export-menu__panel" role="menu">
          <div className="export-menu__header">
            <span className="export-menu__header-icon">
              <FileDown size={20} />
            </span>
            <div>
              <h3 className="export-menu__title">Export Data</h3>
              <p className="export-menu__description">
                Download your store&rsquo;s daily checklist data for the selected date range.
              </p>
            </div>
          </div>

          <div className="export-menu__section">
            <h4 className="export-menu__section-title">Date Range</h4>
            <div className="export-menu__range-row">
              <label className="export-menu__field">
                <span className="export-menu__field-label">From</span>
                <button
                  type="button"
                  ref={fromTriggerRef}
                  className="export-menu__date-trigger"
                  onClick={() => setFromPickerOpen((v) => !v)}
                  aria-expanded={fromPickerOpen}
                >
                  <Calendar size={14} />
                  <span className="export-menu__date-value">{formatRangeDate(rangeStart)}</span>
                  <ChevronDown size={13} className="export-menu__date-chevron" />
                </button>
              </label>
              <label className="export-menu__field">
                <span className="export-menu__field-label">To</span>
                <button
                  type="button"
                  ref={toTriggerRef}
                  className="export-menu__date-trigger"
                  onClick={() => setToPickerOpen((v) => !v)}
                  aria-expanded={toPickerOpen}
                >
                  <Calendar size={14} />
                  <span className="export-menu__date-value">{formatRangeDate(rangeEnd)}</span>
                  <ChevronDown size={13} className="export-menu__date-chevron" />
                </button>
              </label>
            </div>
            {rangeError && <p className="export-menu__range-error">{rangeError}</p>}
          </div>

          <div className="export-menu__section">
            <h4 className="export-menu__section-title">Export Format</h4>
            <div className="export-menu__format-row" role="radiogroup" aria-label="Export format">
              <button
                type="button"
                role="radio"
                aria-checked={format === 'excel'}
                className={`export-menu__format-card${format === 'excel' ? ' export-menu__format-card--selected' : ''}`}
                onClick={() => setFormat('excel')}
              >
                <span className="export-menu__format-radio" aria-hidden="true" />
                <span className="export-menu__format-icon export-menu__format-icon--excel">
                  <FileSpreadsheet size={20} />
                </span>
                <span className="export-menu__format-label">Excel</span>
                <span className="export-menu__format-desc">Best for analysis &amp; editing</span>
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={format === 'pdf'}
                className={`export-menu__format-card${format === 'pdf' ? ' export-menu__format-card--selected' : ''}`}
                onClick={() => setFormat('pdf')}
              >
                <span className="export-menu__format-radio" aria-hidden="true" />
                <span className="export-menu__format-icon export-menu__format-icon--pdf">
                  <FileText size={20} />
                </span>
                <span className="export-menu__format-label">PDF</span>
                <span className="export-menu__format-desc">Best for sharing &amp; printing</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            className="btn btn--danger export-menu__download"
            onClick={handleDownload}
            disabled={downloading || !storeId}
          >
            <Download size={15} />
            {format === 'excel'
              ? (rangeExporting ? 'Downloading…' : 'Download Excel')
              : (pdfRangeExporting ? 'Generating…' : 'Download PDF')}
          </button>
        </div>
      )}

      <CalendarPopover
        value={rangeStart}
        max={todayDate()}
        isOpen={fromPickerOpen}
        onClose={() => setFromPickerOpen(false)}
        onSelect={(d) => { setRangeStart(d); setRangeError(null); }}
        anchorRef={fromTriggerRef}
      />
      <CalendarPopover
        value={rangeEnd}
        min={rangeStart}
        max={todayDate()}
        isOpen={toPickerOpen}
        onClose={() => setToPickerOpen(false)}
        onSelect={(d) => { setRangeEnd(d); setRangeError(null); }}
        anchorRef={toTriggerRef}
      />
    </div>
  );
}

export default ExportMenu;
