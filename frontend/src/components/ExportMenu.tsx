import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown, Download, Printer } from 'lucide-react';
import { getChecklistHistoryOperationsReport } from '../api/checklistHistory';
import { buildOperationsReportCsv, summarizeByStore } from '../utils/operationsReportExport';
import { downloadCsv } from '../utils/csv';
import { MAX_RANGE_DAYS, todayDate } from '../utils/checklistHistoryOptions';
import './ExportMenu.css';

interface ExportMenuProps {
  storeId: number | null;
  date: string;
}

function ExportMenu({ storeId, date }: ExportMenuProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState<'idle' | 'range'>('idle');
  const [rangeStart, setRangeStart] = useState(date);
  const [rangeEnd, setRangeEnd] = useState(date);
  const [exporting, setExporting] = useState(false);
  const [rangeExporting, setRangeExporting] = useState(false);
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
      const report = await getChecklistHistoryOperationsReport({ startDate: date, endDate: date });
      const summary = summarizeByStore(report.summary);
      const csv = buildOperationsReportCsv(summary, report.details, date, date);
      downloadCsv(`checklist-${date}.csv`, csv);
      setMenuOpen(false);
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
      const report = await getChecklistHistoryOperationsReport({ startDate: rangeStart, endDate: rangeEnd });
      const summary = summarizeByStore(report.summary);
      const csv = buildOperationsReportCsv(summary, report.details, rangeStart, rangeEnd);
      downloadCsv(`checklist-${rangeStart}_to_${rangeEnd}.csv`, csv);
      setMenuOpen(false);
      setMode('idle');
    } catch (err) {
      setRangeError(err instanceof Error ? err.message : 'Export failed.');
    } finally {
      setRangeExporting(false);
    }
  }

  function handlePrint() {
    setMenuOpen(false);
    document.body.classList.add('printing-store-detail');
    window.print();
    document.body.classList.remove('printing-store-detail');
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
            <Download size={14} />
            {exporting ? 'Downloading…' : 'Export this day (CSV)'}
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
                {rangeExporting ? 'Downloading…' : 'Download CSV'}
              </button>
            </div>
          )}

          <div className="export-menu__divider" role="separator" />

          <button
            type="button"
            className="export-menu__item"
            role="menuitem"
            onClick={handlePrint}
          >
            <Printer size={14} />
            Print this day
          </button>
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
