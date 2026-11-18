// Month and year grids shared by CalendarPopover (its month / year views) and
// MonthPickerPopover, so every picker in the app shows the same 3 x 4 grids
// with the same selected fill and "current" ring. Styles: CalendarPopover.css.

// Years per page in a year view: a 3 x 4 grid, the same shape as the months.
export const YEARS_PER_PAGE = 12;

export function firstYearOfPage(year: number): number {
  return year - (((year % YEARS_PER_PAGE) + YEARS_PER_PAGE) % YEARS_PER_PAGE);
}

function cellClass(isSelected: boolean, isCurrent: boolean): string {
  return `calendar-popover__cell calendar-popover__period-cell${isSelected ? ' calendar-popover__cell--selected' : ''}${isCurrent && !isSelected ? ' calendar-popover__cell--today' : ''}`;
}

interface MonthGridProps {
  year: number;
  // Month index (0-11) shown as selected in this year, or null for none.
  selectedMonth: number | null;
  // Month index (0-11) of the current month if it falls in this year.
  currentMonth: number | null;
  isDisabled: (monthIndex: number) => boolean;
  onPick: (monthIndex: number) => void;
}

export function MonthGrid({ year, selectedMonth, currentMonth, isDisabled, onPick }: MonthGridProps) {
  return (
    <div className="calendar-popover__period-grid">
      {Array.from({ length: 12 }, (_, monthIndex) => {
        const date = new Date(year, monthIndex, 1);
        const isSelected = monthIndex === selectedMonth;
        return (
          <button
            key={monthIndex}
            type="button"
            className={cellClass(isSelected, monthIndex === currentMonth)}
            disabled={isDisabled(monthIndex)}
            aria-label={date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            aria-pressed={isSelected}
            onClick={() => onPick(monthIndex)}
          >
            {date.toLocaleDateString(undefined, { month: 'short' })}
          </button>
        );
      })}
    </div>
  );
}

interface YearGridProps {
  pageStart: number;
  selectedYear: number;
  currentYear: number;
  isDisabled: (year: number) => boolean;
  onPick: (year: number) => void;
}

export function YearGrid({ pageStart, selectedYear, currentYear, isDisabled, onPick }: YearGridProps) {
  return (
    <div className="calendar-popover__period-grid">
      {Array.from({ length: YEARS_PER_PAGE }, (_, index) => {
        const year = pageStart + index;
        const isSelected = year === selectedYear;
        return (
          <button
            key={year}
            type="button"
            className={cellClass(isSelected, year === currentYear)}
            disabled={isDisabled(year)}
            aria-pressed={isSelected}
            onClick={() => onPick(year)}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}
