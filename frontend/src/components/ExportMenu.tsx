import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getChecklistHistoryOperationsReport } from '../api/checklistHistory';
import { buildOperationsReportWorkbook, summarizeByStore } from '../utils/operationsReportExport';
import { buildAndDownloadOperationsReportPdf } from '../utils/operationsReportPdfExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import ButtonDots from './ButtonDots';
import CalendarPopover from './CalendarPopover';
import { MAX_RANGE_DAYS, formatDateLabel, todayDate } from '../utils/checklistHistoryOptions';
import './ExportMenu.css';

interface ExportMenuProps {
  storeId: number | null;
  date: string;
  storeName?: string | null;
  // Set while a multi-day filter (e.g. "Last Week") is active, so Export
  // defaults to that same range instead of a single day that no longer
  // matches what's on screen -- see StoreDetail.tsx/SuperAdminChecklist.tsx.
  rangeOverride?: { start: string; end: string };
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

function ExportMenu({ storeId, date, storeName, rangeOverride }: ExportMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<'idle' | 'range'>('idle');
  const [rangeStart, setRangeStart] = useState(date);
  const [rangeEnd, setRangeEnd] = useState(date);
  const [exporting, setExporting] = useState(false);
  const [rangeExporting, setRangeExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfRangeExporting, setPdfRangeExporting] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  // Which of the two inline date pickers (if either) is open -- mutually
  // exclusive, same pattern as DateRangePicker's From/To calendars.
  const [openCalendar, setOpenCalendar] = useState<'from' | 'to' | null>(null);
  const fromTriggerRef = useRef<HTMLButtonElement>(null);
  const toTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setRangeStart(rangeOverride?.start ?? date);
    setRangeEnd(rangeOverride?.end ?? date);
  }, [date, rangeOverride?.start, rangeOverride?.end]);

  // With a range already selected outside this menu (e.g. "Last Week"), the
  // single-day export buttons below (which always act on `date`) no longer
  // make sense -- the range form is the only option, so it's shown directly
  // instead of behind the "Export date range…" toggle.
  const showRangeForm = mode === 'range' || rangeOverride != null;

  function closeMenu() {
    setMenuOpen(false);
    setMode('idle');
    setRangeError(null);
    setOpenCalendar(null);
  }

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
    <DropdownMenu open={menuOpen} onOpenChange={(open) => (open ? setMenuOpen(true) : closeMenu())}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="btn btn--danger export-menu__trigger"
          onClick={() => { setMode('idle'); setRangeError(null); }}
        >
          Export
          <ChevronDown size={13} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className="export-menu__dropdown w-auto border-none bg-transparent p-0 shadow-none"
      >
          {!rangeOverride && (
            <DropdownMenuItem
              className={`export-menu__item${exporting ? ' btn--loading' : ''}`}
              onSelect={(event) => {
                event.preventDefault();
                handleExportToday();
              }}
              disabled={exporting || !storeId}
            >
              {exporting ? <ButtonDots label="Downloading" /> : (<><FileSpreadsheet size={14} />Export this day (Excel)</>)}
            </DropdownMenuItem>
          )}

          {!rangeOverride && (
            <DropdownMenuItem
              className="export-menu__item"
              onSelect={(event) => {
                event.preventDefault();
                setMode((m) => (m === 'range' ? 'idle' : 'range'));
                setRangeError(null);
                setOpenCalendar(null);
              }}
              aria-expanded={mode === 'range'}
            >
              <Calendar size={14} />
              Export date range…
            </DropdownMenuItem>
          )}

          {showRangeForm && (
            <div className="export-menu__range-form">
              <div className="export-menu__range-row">
                <div className="export-menu__range-label">
                  From
                  <button
                    ref={fromTriggerRef}
                    type="button"
                    className="export-menu__date-trigger"
                    onClick={() => setOpenCalendar((current) => (current === 'from' ? null : 'from'))}
                  >
                    {formatDateLabel(rangeStart)}
                  </button>
                  <CalendarPopover
                    value={rangeStart}
                    max={todayDate()}
                    isOpen={openCalendar === 'from'}
                    onClose={() => setOpenCalendar(null)}
                    onSelect={(value) => { setRangeStart(value); setRangeError(null); }}
                    onClear={() => { setRangeStart(rangeOverride?.start ?? date); setRangeError(null); }}
                    onToday={() => { setRangeStart(todayDate()); setRangeError(null); }}
                    anchorRef={fromTriggerRef}
                  />
                </div>
                <div className="export-menu__range-label">
                  To
                  <button
                    ref={toTriggerRef}
                    type="button"
                    className="export-menu__date-trigger"
                    onClick={() => setOpenCalendar((current) => (current === 'to' ? null : 'to'))}
                  >
                    {formatDateLabel(rangeEnd)}
                  </button>
                  <CalendarPopover
                    value={rangeEnd}
                    min={rangeStart}
                    max={todayDate()}
                    isOpen={openCalendar === 'to'}
                    onClose={() => setOpenCalendar(null)}
                    onSelect={(value) => { setRangeEnd(value); setRangeError(null); }}
                    onClear={() => { setRangeEnd(rangeOverride?.end ?? date); setRangeError(null); }}
                    onToday={() => { setRangeEnd(todayDate()); setRangeError(null); }}
                    anchorRef={toTriggerRef}
                  />
                </div>
              </div>
              {rangeError && <p className="export-menu__range-error">{rangeError}</p>}
              <div className="export-menu__range-row">
                <button
                  type="button"
                  className={`btn btn--primary export-menu__range-download${rangeExporting ? ' btn--loading' : ''}`}
                  onClick={handleExportRange}
                  disabled={rangeExporting || pdfRangeExporting}
                >
                  {rangeExporting ? <ButtonDots label="Downloading" /> : 'Download Excel'}
                </button>
                <button
                  type="button"
                  className={`btn btn--secondary export-menu__range-download${pdfRangeExporting ? ' btn--loading' : ''}`}
                  onClick={handleExportPdfRange}
                  disabled={rangeExporting || pdfRangeExporting}
                >
                  {pdfRangeExporting ? <ButtonDots label="Generating" /> : 'Download PDF'}
                </button>
              </div>
            </div>
          )}

          {!rangeOverride && (
            <>
              <DropdownMenuSeparator className="export-menu__divider" />

              <DropdownMenuItem
                className={`export-menu__item${pdfExporting ? ' btn--loading' : ''}`}
                onSelect={handleExportPdf}
                disabled={pdfExporting || !storeId}
              >
                {pdfExporting ? <ButtonDots label="Generating PDF" /> : (<><FileText size={14} />Export as PDF</>)}
              </DropdownMenuItem>
            </>
          )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default ExportMenu;
