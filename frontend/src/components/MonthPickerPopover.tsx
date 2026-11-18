import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import useAnchoredPopoverPosition from '../hooks/useAnchoredPopoverPosition';
import useDismissablePanel from '../hooks/useDismissablePanel';
import { MonthGrid, YEARS_PER_PAGE, YearGrid, firstYearOfPage } from './CalendarPeriodGrids';
import './CalendarPopover.css';

interface MonthPickerPopoverProps {
  // YYYY-MM, local calendar.
  value: string;
  // Latest selectable month (YYYY-MM); later months are disabled.
  max?: string;
  isOpen: boolean;
  onClose: () => void;
  onSelect: (month: string) => void;
  anchorRef: React.RefObject<HTMLElement>;
}

function toMonthKey(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
}

function currentMonthKey(): string {
  const now = new Date();
  return toMonthKey(now.getFullYear(), now.getMonth());
}

// The month-only twin of CalendarPopover, built from its classes and its
// month / year grids so the two read as one calendar: same panel, same round
// prev/next buttons (stepping a year here), same selected fill, "current" ring
// and footer shortcut. Clicking the year label swaps in the year grid (arrows
// then step 12 years); picking a year returns to that year's months.
function MonthPickerPopover({ value, max, isOpen, onClose, onSelect, anchorRef }: MonthPickerPopoverProps) {
  const [viewYear, setViewYear] = useState(() => Number(value.slice(0, 4)));
  const [view, setView] = useState<'months' | 'years'>('months');
  const [pageStart, setPageStart] = useState(() => firstYearOfPage(Number(value.slice(0, 4))));
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const year = Number(value.slice(0, 4));
    setViewYear(year);
    setPageStart(firstYearOfPage(year));
    setView('months');
  }, [isOpen, value]);

  const position = useAnchoredPopoverPosition(isOpen, anchorRef, panelRef, [viewYear, view, pageStart]);
  useDismissablePanel({ isOpen, onClose, refs: [anchorRef, panelRef], closeOnScrollOrResize: false });

  if (!isOpen) return null;

  const thisMonth = currentMonthKey();
  const thisYear = Number(thisMonth.slice(0, 4));
  const maxYear = max ? Number(max.slice(0, 4)) : null;
  const isYearView = view === 'years';
  const pageEnd = pageStart + YEARS_PER_PAGE - 1;
  const isNextDisabled = maxYear != null && (isYearView ? pageEnd + 1 > maxYear : viewYear + 1 > maxYear);
  const isThisMonthDisabled = max != null && thisMonth > max;
  const valueYear = Number(value.slice(0, 4));

  function choose(month: string) {
    onSelect(month);
    onClose();
  }

  return createPortal(
    <div ref={panelRef} className="calendar-popover" role="dialog" aria-label="Choose a month" style={position}>
      <div className="calendar-popover__header">
        <button
          type="button"
          className="calendar-popover__nav"
          aria-label={isYearView ? 'Previous years' : 'Previous year'}
          onClick={() => (isYearView
            ? setPageStart((start) => start - YEARS_PER_PAGE)
            : setViewYear((year) => year - 1))}
        >
          <ChevronLeft size={16} />
        </button>
        {isYearView ? (
          <span className="calendar-popover__label">{pageStart} – {pageEnd}</span>
        ) : (
          <button
            type="button"
            className="calendar-popover__label calendar-popover__label-button"
            aria-label={`${viewYear}, choose a year`}
            onClick={() => { setPageStart(firstYearOfPage(viewYear)); setView('years'); }}
          >
            {viewYear}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          className="calendar-popover__nav"
          aria-label={isYearView ? 'Next years' : 'Next year'}
          disabled={isNextDisabled}
          onClick={() => (isYearView
            ? setPageStart((start) => start + YEARS_PER_PAGE)
            : setViewYear((year) => year + 1))}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {isYearView ? (
        <YearGrid
          pageStart={pageStart}
          selectedYear={viewYear}
          currentYear={thisYear}
          isDisabled={(year) => maxYear != null && year > maxYear}
          onPick={(year) => { setViewYear(year); setView('months'); }}
        />
      ) : (
        <MonthGrid
          year={viewYear}
          selectedMonth={viewYear === valueYear ? Number(value.slice(5, 7)) - 1 : null}
          currentMonth={viewYear === thisYear ? Number(thisMonth.slice(5, 7)) - 1 : null}
          isDisabled={(monthIndex) => max != null && toMonthKey(viewYear, monthIndex) > max}
          onPick={(monthIndex) => choose(toMonthKey(viewYear, monthIndex))}
        />
      )}

      <div className="calendar-popover__footer">
        <span />
        <button
          type="button"
          className="calendar-popover__footer-action calendar-popover__footer-action--today"
          disabled={isThisMonthDisabled}
          onClick={() => choose(thisMonth)}
        >
          This month
        </button>
      </div>
    </div>,
    document.body,
  );
}

export default MonthPickerPopover;
