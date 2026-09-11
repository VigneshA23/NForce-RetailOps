import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, FileSpreadsheet, FileText } from 'lucide-react';
import { jsPDF } from 'jspdf';
import { getChecklistHistoryOperationsReport } from '../api/checklistHistory';
import { buildOperationsReportWorkbook, summarizeByStore } from '../utils/operationsReportExport';
import { downloadWorkbook } from '../utils/xlsx';
import { nfToast } from '../utils/toast';
import { MAX_RANGE_DAYS, todayDate } from '../utils/checklistHistoryOptions';
import './ExportMenu.css';

interface ExportMenuProps {
  storeId: number | null;
  date: string;
  storeName?: string | null;
}

function ExportMenu({ storeId, date, storeName }: ExportMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<'idle' | 'range'>('idle');
  const [rangeStart, setRangeStart] = useState(date);
  const [rangeEnd, setRangeEnd] = useState(date);
  const [exporting, setExporting] = useState(false);
  const [rangeExporting, setRangeExporting] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
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
      const workbook = buildOperationsReportWorkbook(summary, report.details, date, date);
      await downloadWorkbook(`checklist-${date}.xlsx`, workbook);
      setMenuOpen(false);
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  }

  async function handleExportRange() {
    setRangeError(null);
    if (rangeStart > rangeEnd) {
      setRangeError('Start date must be on or before end date.');
      return;
    }
    const days = (new Date(`${rangeEnd}T00:00:00`).getTime() - new Date(`${rangeStart}T00:00:00`).getTime()) / 86_400_000;
    if (days > MAX_RANGE_DAYS) {
      setRangeError(`Max ${MAX_RANGE_DAYS} days.`);
      return;
    }
    setRangeExporting(true);
    try {
      const report = await getChecklistHistoryOperationsReport({ startDate: rangeStart, endDate: rangeEnd, storeId: storeId ?? undefined });
      const summary = summarizeByStore(report.summary);
      const workbook = buildOperationsReportWorkbook(summary, report.details, rangeStart, rangeEnd);
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
      const details = report.details;

      const title = storeName ?? storeEntry?.storeName ?? 'Store';
      const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
      });

      const total = storeEntry?.scheduled ?? 0;
      const completed = storeEntry?.completed ?? 0;
      const open = total - completed;
      const pct = total === 0 ? 0 : Math.round((completed / total) * 100);

      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const margin = 14;
      let y = margin;

      // Header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(18);
      doc.text(title, margin, y);
      y += 7;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(100, 100, 100);
      doc.text(`Daily Checklist — ${formattedDate}`, margin, y);
      y += 5;

      // Divider
      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageW - margin, y);
      y += 7;

      // Stats row
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('SUMMARY', margin, y);
      y += 5;

      doc.setFont('helvetica', 'normal');
      const stats = [
        `Total Tasks: ${total}`,
        `Completed: ${completed}`,
        `No Response: ${open}`,
        `Completion: ${pct}%`,
      ];
      const colW = (pageW - 2 * margin) / stats.length;
      stats.forEach((stat, i) => {
        doc.text(stat, margin + i * colW, y);
      });
      y += 8;

      doc.setDrawColor(220, 220, 220);
      doc.line(margin, y, pageW - margin, y);
      y += 7;

      // Table header
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('TASKS', margin, y);
      y += 5;

      const colCat = margin;
      const colTask = margin + 38;
      const colStatus = margin + 110;
      const colEmployee = margin + 130;

      doc.setFillColor(245, 245, 245);
      doc.rect(margin, y - 4, pageW - 2 * margin, 6, 'F');
      doc.setFontSize(9);
      doc.text('Category', colCat, y);
      doc.text('Task', colTask, y);
      doc.text('Status', colStatus, y);
      doc.text('Employee', colEmployee, y);
      y += 5;

      doc.setDrawColor(200, 200, 200);
      doc.line(margin, y - 1, pageW - margin, y - 1);

      // Task rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const rowH = 5.5;
      for (const row of details) {
        if (y + rowH > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        const statusLabel = row.status === 'COMPLETED' ? 'Done' : row.status === 'ISSUE' ? 'Issue' : 'Open';
        doc.text(doc.splitTextToSize(row.categoryName, 36), colCat, y);
        doc.text(doc.splitTextToSize(row.taskName, 70), colTask, y);
        doc.text(statusLabel, colStatus, y);
        doc.text(doc.splitTextToSize(row.employeeFullName ?? '—', 50), colEmployee, y);
        y += rowH;
        doc.setDrawColor(235, 235, 235);
        doc.line(margin, y - 1, pageW - margin, y - 1);
      }

      // Footer
      y += 4;
      doc.setTextColor(150, 150, 150);
      doc.setFontSize(7.5);
      doc.text(`Generated ${new Date().toLocaleString()}`, margin, y);

      doc.save(`checklist-${date}.pdf`);
    } catch (err) {
      nfToast.error(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setPdfExporting(false);
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
              <button
                type="button"
                className="btn btn--primary export-menu__range-download"
                onClick={handleExportRange}
                disabled={rangeExporting}
              >
                {rangeExporting ? 'Downloading…' : 'Download Excel'}
              </button>
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
