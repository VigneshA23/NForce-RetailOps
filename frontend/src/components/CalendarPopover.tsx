import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import './CalendarPopover.css'

const VIEWPORT_MARGIN = 8

interface CalendarPopoverProps {
  // YYYY-MM-DD, local calendar -- matches the rest of EmployeeHistory's date
  // handling (deliberately not UTC, see toDateKey below).
  value: string
  max?: string
  isOpen: boolean
  onClose: () => void
  onSelect: (date: string) => void
  anchorRef: React.RefObject<HTMLElement>
}

function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function CalendarPopover({ value, max, isOpen, onClose, onSelect, anchorRef }: CalendarPopoverProps) {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [viewDate, setViewDate] = useState(() => new Date(`${value}T00:00:00`))
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (isOpen) setViewDate(new Date(`${value}T00:00:00`))
  }, [isOpen, value])

  // Portal + measure-after-render, same pattern as SearchableSelect -- but
  // this panel also clamps horizontally (SearchableSelect never needs to,
  // since its panel is always sized to match its trigger's width). A native
  // <input type="date"> picker anchored near a trigger close to the screen
  // edge has no such clamp, which is what let it run off-screen on mobile.
  useLayoutEffect(() => {
    if (!isOpen) return
    const anchor = anchorRef.current
    const panel = panelRef.current
    if (!anchor || !panel) return

    const anchorRect = anchor.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()

    let top = anchorRect.bottom + 8
    if (top + panelRect.height > window.innerHeight - VIEWPORT_MARGIN) {
      top = anchorRect.top - panelRect.height - 8
    }
    top = Math.max(VIEWPORT_MARGIN, top)

    let left = anchorRect.right - panelRect.width
    left = Math.min(left, window.innerWidth - panelRect.width - VIEWPORT_MARGIN)
    left = Math.max(VIEWPORT_MARGIN, left)

    setPosition((current) => (current.top === top && current.left === left ? current : { top, left }))
  }, [isOpen, anchorRef, viewDate])

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (anchorRef.current?.contains(target)) return
      if (panelRef.current?.contains(target)) return
      onClose()
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose, anchorRef])

  if (!isOpen) return null

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstOfMonth = new Date(year, month, 1)
  const startOffset = firstOfMonth.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const todayKey = toDateKey(new Date())
  const maxDate = max ? new Date(`${max}T00:00:00`) : null
  const isNextDisabled = maxDate != null && new Date(year, month + 1, 1) > maxDate

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
          aria-label="Previous month"
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
          const isDisabled = maxDate != null && cellDate > maxDate
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
    </div>,
    document.body,
  )
}

export default CalendarPopover
