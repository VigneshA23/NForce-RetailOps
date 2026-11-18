import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { MonthGrid, YEARS_PER_PAGE, YearGrid, firstYearOfPage } from './CalendarPeriodGrids'
import useAnchoredPopoverPosition from '../hooks/useAnchoredPopoverPosition'
import useDismissablePanel from '../hooks/useDismissablePanel'
import './CalendarPopover.css'

interface CalendarPopoverProps {
  // YYYY-MM-DD, local calendar -- matches the rest of EmployeeHistory's date
  // handling (deliberately not UTC, see toDateKey below).
  value: string
  min?: string
  max?: string
  isOpen: boolean
  onClose: () => void
  onSelect: (date: string) => void
  anchorRef: React.RefObject<HTMLElement>
  // Optional bottom-corner shortcuts (Clear bottom-left, Today bottom-right).
  // Both are opt-in -- omitting them keeps every existing caller (date nav,
  // DateRangePicker, ChecklistDayHistoryView, MissingTasks) unchanged.
  onClear?: () => void
  onToday?: () => void
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function CalendarPopover({ value, min, max, isOpen, onClose, onSelect, anchorRef, onClear, onToday }: CalendarPopoverProps) {
  const [viewDate, setViewDate] = useState(() => new Date(`${value}T00:00:00`))
  // 'days' is the normal calendar. Clicking its "June 2026" label opens
  // 'months' (that year's 12 months); clicking the year there opens 'years'.
  // Picking a year returns to its months, picking a month to its days.
  const [view, setView] = useState<'days' | 'months' | 'years'>('days')
  const [pageStart, setPageStart] = useState(() => firstYearOfPage(new Date(`${value}T00:00:00`).getFullYear()))
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) {
      setViewDate(new Date(`${value}T00:00:00`))
      setView('days')
    }
  }, [isOpen, value])

  // Portal + measure-after-render, clamped inside the viewport on both axes
  // (a native <input type="date"> picker has no such clamp, which is what let
  // it run off-screen on mobile). Shared with MonthPickerPopover.
  const position = useAnchoredPopoverPosition(isOpen, anchorRef, panelRef, [viewDate, view, pageStart])

  useDismissablePanel({ isOpen, onClose, refs: [anchorRef, panelRef], closeOnScrollOrResize: false })

  if (!isOpen) return null

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = toDateKey(new Date())
  const minDate = min ? new Date(`${min}T00:00:00`) : null
  const maxDate = max ? new Date(`${max}T00:00:00`) : null
  const isNextDisabled = maxDate != null && new Date(year, month + 1, 1) > maxDate
  const isPrevDisabled = minDate != null && new Date(year, month, 0) < minDate
  const now = new Date()
  const todayCellDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const isTodayDisabled = (maxDate != null && todayCellDate > maxDate) || (minDate != null && todayCellDate < minDate)

  // A month or year is selectable when any of its days falls inside min/max.
  const isRangeOutside = (first: Date, last: Date) =>
    (maxDate != null && first > maxDate) || (minDate != null && last < minDate)
  const isMonthDisabled = (y: number, m: number) => isRangeOutside(new Date(y, m, 1), new Date(y, m + 1, 0))
  const isYearDisabled = (y: number) => isRangeOutside(new Date(y, 0, 1), new Date(y, 11, 31))
  const pageEnd = pageStart + YEARS_PER_PAGE - 1
  const selectedDate = new Date(`${value}T00:00:00`)

  // Header arrows step a month, a year or a page of years depending on view.
  const header = view === 'days'
    ? {
      prevLabel: 'Previous month',
      nextLabel: 'Next month',
      prevDisabled: isPrevDisabled,
      nextDisabled: isNextDisabled,
      onPrev: () => setViewDate(new Date(year, month - 1, 1)),
      onNext: () => setViewDate(new Date(year, month + 1, 1)),
    }
    : view === 'months'
      ? {
        prevLabel: 'Previous year',
        nextLabel: 'Next year',
        prevDisabled: isYearDisabled(year - 1),
        nextDisabled: isYearDisabled(year + 1),
        onPrev: () => setViewDate(new Date(year - 1, month, 1)),
        onNext: () => setViewDate(new Date(year + 1, month, 1)),
      }
      : {
        prevLabel: 'Previous years',
        nextLabel: 'Next years',
        prevDisabled: isRangeOutside(new Date(pageStart - YEARS_PER_PAGE, 0, 1), new Date(pageStart - 1, 11, 31)),
        nextDisabled: isRangeOutside(new Date(pageEnd + 1, 0, 1), new Date(pageEnd + YEARS_PER_PAGE, 11, 31)),
        onPrev: () => setPageStart((start) => start - YEARS_PER_PAGE),
        onNext: () => setPageStart((start) => start + YEARS_PER_PAGE),
      }

  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return createPortal(
    <div ref={panelRef} className="calendar-popover" role="dialog" aria-label="Choose a date" style={position}>
      <div className="calendar-popover__header">
        <button
          type="button"
          className="calendar-popover__nav"
          aria-label={header.prevLabel}
          disabled={header.prevDisabled}
          onClick={header.onPrev}
        >
          <ChevronLeft size={16} />
        </button>
        {view === 'days' ? (
          <button
            type="button"
            className="calendar-popover__label calendar-popover__label-button"
            aria-label={`${firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}, choose a month`}
            onClick={() => setView('months')}
          >
            {firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        ) : view === 'months' ? (
          <button
            type="button"
            className="calendar-popover__label calendar-popover__label-button"
            aria-label={`${year}, choose a year`}
            onClick={() => { setPageStart(firstYearOfPage(year)); setView('years') }}
          >
            {year}
            <ChevronDown size={14} aria-hidden="true" />
          </button>
        ) : (
          <span className="calendar-popover__label">{pageStart} – {pageEnd}</span>
        )}
        <button
          type="button"
          className="calendar-popover__nav"
          aria-label={header.nextLabel}
          disabled={header.nextDisabled}
          onClick={header.onNext}
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {view === 'months' && (
        <MonthGrid
          year={year}
          selectedMonth={selectedDate.getFullYear() === year ? selectedDate.getMonth() : null}
          currentMonth={now.getFullYear() === year ? now.getMonth() : null}
          isDisabled={(m) => isMonthDisabled(year, m)}
          onPick={(m) => { setViewDate(new Date(year, m, 1)); setView('days') }}
        />
      )}

      {view === 'years' && (
        <YearGrid
          pageStart={pageStart}
          selectedYear={year}
          currentYear={now.getFullYear()}
          isDisabled={isYearDisabled}
          onPick={(y) => { setViewDate(new Date(y, month, 1)); setView('months') }}
        />
      )}

      {view === 'days' && (
      <>
      <div className="calendar-popover__weekdays">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={index}>{label}</span>
        ))}
      </div>

      <div className="calendar-popover__grid">
        {cells.map((day, index) => {
          if (day == null) return <span key={index} className="calendar-popover__cell calendar-popover__cell--empty" />
          const cellDate = new Date(year, month, day)
          const dateKey = toDateKey(cellDate)
          const isDisabled = (maxDate != null && cellDate > maxDate) || (minDate != null && cellDate < minDate)
          const isSelected = dateKey === value
          const isToday = dateKey === todayKey
          return (
            <button
              key={index}
              type="button"
              className={`calendar-popover__cell${isSelected ? ' calendar-popover__cell--selected' : ''}${isToday && !isSelected ? ' calendar-popover__cell--today' : ''}`}
              disabled={isDisabled}
              onClick={() => {
                onSelect(dateKey)
                onClose()
              }}
            >
              {day}
            </button>
          )
        })}
      </div>
      </>
      )}

      {(onClear || onToday) && (
        <div className="calendar-popover__footer">
          {onClear ? (
            <button
              type="button"
              className="calendar-popover__footer-action"
              onClick={() => { onClear(); onClose() }}
            >
              Clear
            </button>
          ) : <span />}
          {onToday ? (
            <button
              type="button"
              className="calendar-popover__footer-action calendar-popover__footer-action--today"
              disabled={isTodayDisabled}
              onClick={() => { onToday(); onClose() }}
            >
              Today
            </button>
          ) : <span />}
        </div>
      )}
    </div>,
    document.body,
  )
}

export default CalendarPopover
