import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { getChecklistHistoryOperationsReport } from '../api/checklistHistory';
import { buildOperationsReportWorkbook, summarizeByStore } from '../utils/operationsReportExport';
import { buildAndDownloadOperationsReportPdf } from '../utils/operationsReportPdfExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import { MAX_RANGE_DAYS, todayDate } from '../utils/checklistHistoryOptions';
import './ExportMenu.css';

interface ExportMenuProps {
  storeId: number | null;
  date: string;
  storeName?: string | null;
}

// Shared by the single-day and date-range PDF exports -- deliberately a richer,
// more human subtitle style (weekday spelled out) than Excel's own formatLongDate,
// which this file has never matched exactly since the two exports' headers were
// designed independently.
function formatPdfDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
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
  const [mode, setMode] = useState<'idle' | 'range'>('idle');
  const [rangeStart, setRangeStart] = useState(date);
  const [rangeEnd, setRangeEnd] = useState(date);
  const [exporting, setExporting] = useState(false);
  const [rangeExporting, setRangeExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfRangeExporting, setPdfRangeExporting] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRangeStart(date);
    setRangeEnd(date);
  }, [date]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setMode('idle');
        setRangeError(null);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [menuOpen]);

  async function handleExportToday() {
    if (!storeId) return;
    setExporting(true);
    try {
      const report = await getChecklistHistoryOperationsReport({ startDate: date, endDate: date, storeId: storeId ?? undefined });
      const summary = summarizeByStore(report.summary);
      const workbook = await buildOperationsReportWorkbook(summary, report.details, date, date);
      await downloadWorkbook(`checklist-${date}.xlsx`, workbook);
      setMenuOpen(false);
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

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
      setMode('idle');
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setRangeExporting(false);
    }
  }

  async function handleExportPdf() {
    if (!storeId) return;
    setPdfExporting(true);
    setMenuOpen(false);
    try {
      const report = await getChecklistHistoryOperationsReport({ startDate: date, endDate: date, storeId: storeId ?? undefined });
      const summary = summarizeByStore(report.summary);
      const storeEntry = summary[0];
      await buildAndDownloadOperationsReportPdf({
        title: storeName ?? storeEntry?.storeName ?? 'Store',
        dateLabel: formatPdfDateLabel(date),
        // Same Scheduled/Completed/Completion %/Issues stat set as the Excel export's
        // Store Summary section, rather than this file's own previously-independent
        // Total/Completed/No Response/Completion% -- that divergence was silently
        // folding Issues into "No Response".
        scheduled: storeEntry?.scheduled ?? 0,
        completed: storeEntry?.completed ?? 0,
        issues: storeEntry?.issues ?? 0,
        details: report.details,
        filename: `checklist-${date}.pdf`,
      });
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setPdfExporting(false);
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
      setMode('idle');
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setPdfRangeExporting(false);
    }
  }

  return (
    <div ref={menuRef} className="export-menu">
      <button
        type="button"
        className="btn btn--danger export-menu__trigger"
        onClick={() => { setMenuOpen((v) => !v); setMode('idle'); setRangeError(null); }}
        aria-expanded={menuOpen}
        aria-haspopup="menu"
      >
        Export
        <ChevronDown size={13} />
      </button>

      {menuOpen && (
        <div className="export-menu__dropdown" role="menu">
          <button
            type="button"
            className="export-menu__item"
            role="menuitem"
            onClick={handleExportToday}
            disabled={exporting || !storeId}
          >
            <FileSpreadsheet size={14} />
            {exporting ? 'Downloading…' : 'Export this day (Excel)'}
          </button>

          <button
            type="button"
            className="export-menu__item"
            role="menuitem"
            onClick={() => { setMode((m) => (m === 'range' ? 'idle' : 'range')); setRangeError(null); }}
            aria-expanded={mode === 'range'}
          >
            <Calendar size={14} />
            Export date range…
          </button>

          {mode === 'range' && (
            <div className="export-menu__range-form">
              <div className="export-menu__range-row">
                <label className="export-menu__range-label">
                  From
                  <input
                    type="date"
                    className="export-menu__range-input"
                    value={rangeStart}
                    max={todayDate()}
                    onChange={(e) => { setRangeStart(e.target.value); setRangeError(null); }}
                  />
                </label>
                <label className="export-menu__range-label">
                  To
                  <input
                    type="date"
                    className="export-menu__range-input"
                    value={rangeEnd}
                    min={rangeStart}
                    max={todayDate()}
                    onChange={(e) => { setRangeEnd(e.target.value); setRangeError(null); }}
                  />
                </label>
              </div>
              {rangeError && <p className="export-menu__range-error">{rangeError}</p>}
              <div className="export-menu__range-row">
                <button
                  type="button"
                  className="btn btn--primary export-menu__range-download"
                  onClick={handleExportRange}
                  disabled={rangeExporting || pdfRangeExporting}
                >
                  {rangeExporting ? 'Downloading…' : 'Download Excel'}
                </button>
                <button
                  type="button"
                  className="btn btn--secondary export-menu__range-download"
                  onClick={handleExportPdfRange}
                  disabled={rangeExporting || pdfRangeExporting}
                >
                  {pdfRangeExporting ? 'Generating…' : 'Download PDF'}
                </button>
              </div>
            </div>
          )}

          <div className="export-menu__divider" role="separator" />

          <button
            type="button"
            className="export-menu__item"
            role="menuitem"
            onClick={handleExportPdf}
            disabled={pdfExporting || !storeId}
          >
            <FileText size={14} />
            {pdfExporting ? 'Generating PDF…' : 'Export as PDF'}
          </button>
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
