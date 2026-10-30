import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
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

// The trigger button lives in the CALLER (date nav, DateRangePicker, etc.),
// not in this component -- `anchorRef` points at it. shadcn/Radix Popover
// normally wants its Trigger/Content as siblings under one Root, but
// PopoverAnchor's `virtualRef` lets it anchor to an arbitrary external
// element instead, which keeps every caller's existing anchorRef/isOpen API
// unchanged. Radix's Popper also replaces the old manual
// viewport-clamping/reposition math with built-in collision detection.
function CalendarPopover({ value, min, max, isOpen, onClose, onSelect, anchorRef, onClear, onToday }: CalendarPopoverProps) {
  const [viewDate, setViewDate] = useState(() => new Date(`${value}T00:00:00`))

  useEffect(() => {
    if (isOpen) setViewDate(new Date(`${value}T00:00:00`))
  }, [isOpen, value])

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

  const cells: (number | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <Popover open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <PopoverAnchor virtualRef={anchorRef} />
      <PopoverContent
        align="start"
        sideOffset={8}
        collisionPadding={8}
        aria-label="Choose a date"
        className="calendar-popover w-[272px] border-none bg-transparent p-[var(--space-md)] shadow-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <div className="calendar-popover__header">
          <button
            type="button"
            className="calendar-popover__nav"
            aria-label="Previous month"
            disabled={isPrevDisabled}
            onClick={() => setViewDate(new Date(year, month - 1, 1))}
          >
            <ChevronLeft size={16} />
          </button>
          <span className="calendar-popover__label">
            {firstOfMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
          </span>
          <button
            type="button"
            className="calendar-popover__nav"
            aria-label="Next month"
            disabled={isNextDisabled}
            onClick={() => setViewDate(new Date(year, month + 1, 1))}
          >
            <ChevronRight size={16} />
          </button>
        </div>

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
      </PopoverContent>
    </Popover>
  )
}

export default CalendarPopover
