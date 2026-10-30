import { useEffect, useRef, useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import CalendarPopover from './CalendarPopover';
import { MAX_RANGE_DAYS, daysAgo, formatDateLabel, todayDate, yesterday } from '../utils/checklistHistoryOptions';
import './DateRangePicker.css';

export type DateRangePreset =
  | 'ALL_TIME' | 'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'LAST_30_DAYS'
  | 'THIS_MONTH' | 'LAST_MONTH' | 'CUSTOM';

export interface DateRangeSelection {
  preset: DateRangePreset;
  // Only meaningful when preset is CUSTOM; ignored (but preserved, so
  // reopening the picker still shows the last custom range typed) otherwise.
  customStart: string;
  customEnd: string;
}

export const DEFAULT_DATE_RANGE: DateRangeSelection = {
  preset: 'ALL_TIME',
  customStart: todayDate(),
  customEnd: todayDate(),
};

const PRESET_OPTIONS: { value: Exclude<DateRangePreset, 'CUSTOM'>; label: string }[] = [
  { value: 'ALL_TIME', label: 'All time' },
  { value: 'TODAY', label: 'Today' },
  { value: 'YESTERDAY', label: 'Yesterday' },
  { value: 'LAST_7_DAYS', label: 'Last 7 days' },
  { value: 'LAST_30_DAYS', label: 'Last 30 days' },
  { value: 'THIS_MONTH', label: 'This month' },
  { value: 'LAST_MONTH', label: 'Last month' },
];

const PRESET_LABELS: Record<Exclude<DateRangePreset, 'CUSTOM'>, string> = Object.fromEntries(
  PRESET_OPTIONS.map((option) => [option.value, option.label]),
) as Record<Exclude<DateRangePreset, 'CUSTOM'>, string>;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function ymd(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function monthRange(monthsAgo: number): [string, string] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - monthsAgo;
  const start = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  return [ymd(start.getFullYear(), start.getMonth(), 1), ymd(start.getFullYear(), start.getMonth(), lastDay)];
}

// The concrete [startDate, endDate] window a selection resolves to, or
// undefined for ALL_TIME (no date filter sent to the API at all).
export function resolveDateRange(selection: DateRangeSelection): { startDate: string; endDate: string } | undefined {
  switch (selection.preset) {
    case 'ALL_TIME':
      return undefined;
    case 'TODAY':
      return { startDate: todayDate(), endDate: todayDate() };
    case 'YESTERDAY':
      return { startDate: yesterday(), endDate: yesterday() };
    case 'LAST_7_DAYS':
      return { startDate: daysAgo(6), endDate: todayDate() };
    case 'LAST_30_DAYS':
      return { startDate: daysAgo(29), endDate: todayDate() };
    case 'THIS_MONTH': {
      const [start, end] = monthRange(0);
      return { startDate: start, endDate: end };
    }
    case 'LAST_MONTH': {
      const [start, end] = monthRange(1);
      return { startDate: start, endDate: end };
    }
    case 'CUSTOM':
      return { startDate: selection.customStart, endDate: selection.customEnd };
  }
}

function triggerLabel(selection: DateRangeSelection): string {
  if (selection.preset === 'CUSTOM') {
    return selection.customStart === selection.customEnd
      ? formatDateLabel(selection.customStart)
      : `${formatDateLabel(selection.customStart)} – ${formatDateLabel(selection.customEnd)}`;
  }
  return PRESET_LABELS[selection.preset];
}

function daySpan(startDate: string, endDate: string): number {
  const days = (new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86_400_000;
  return days + 1;
}

interface DateRangePickerProps {
  value: DateRangeSelection;
  onChange: (value: DateRangeSelection) => void;
}

// Same portal + measure-after-render + viewport-clamp pattern as
// ExportMenu/CalendarPopover, so it behaves consistently near screen edges.
function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [draftPreset, setDraftPreset] = useState<DateRangePreset>(value.preset);
  const [draftStart, setDraftStart] = useState(value.customStart);
  const [draftEnd, setDraftEnd] = useState(value.customEnd);
  const [error, setError] = useState<string | null>(null);
  // Which of the two inline date pickers (if either) is open -- mutually
  // exclusive so only one small calendar shows at a time.
  const [openCalendar, setOpenCalendar] = useState<'from' | 'to' | null>(null);
  const fromTriggerRef = useRef<HTMLButtonElement>(null);
  const toTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen) {
      setDraftPreset(value.preset);
      setDraftStart(value.customStart);
      setDraftEnd(value.customEnd);
      setError(null);
      setOpenCalendar(null);
    }
  }, [isOpen, value]);

  function handleApply() {
    if (draftPreset === 'CUSTOM') {
      if (draftStart > draftEnd) {
        setError('Start date must be on or before end date.');
        return;
      }
      if (daySpan(draftStart, draftEnd) > MAX_RANGE_DAYS) {
        setError(`Max ${MAX_RANGE_DAYS} days.`);
        return;
      }
    }
    onChange({ preset: draftPreset, customStart: draftStart, customEnd: draftEnd });
    setIsOpen(false);
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="date-range-picker__trigger"
          aria-haspopup="dialog"
        >
          <Calendar size={14} />
          <span>{triggerLabel(value)}</span>
          <ChevronDown size={14} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={12}
        aria-label="Choose a date range"
        className="date-range-picker__panel w-[240px] max-w-[calc(100vw-24px)] border-none bg-transparent p-[14px] shadow-none"
      >
          <div className="date-range-picker__panel-title">Date Range</div>

          <div className="date-range-picker__options">
            {PRESET_OPTIONS.map((option) => (
              <label key={option.value} className="date-range-picker__option">
                <input
                  type="radio"
                  name="date-range-preset"
                  checked={draftPreset === option.value}
                  onChange={() => { setDraftPreset(option.value); setError(null); }}
                />
                {option.label}
              </label>
            ))}
            <label className="date-range-picker__option">
              <input
                type="radio"
                name="date-range-preset"
                checked={draftPreset === 'CUSTOM'}
                onChange={() => { setDraftPreset('CUSTOM'); setError(null); }}
              />
              Custom range
            </label>
          </div>

          {draftPreset === 'CUSTOM' && (
            <div className="date-range-picker__inputs">
              <div className="date-range-picker__input-label">
                From
                <button
                  ref={fromTriggerRef}
                  type="button"
                  className="date-range-picker__date-trigger"
                  onClick={() => setOpenCalendar((current) => (current === 'from' ? null : 'from'))}
                >
                  {formatDateLabel(draftStart)}
                </button>
                <CalendarPopover
                  value={draftStart}
                  max={todayDate()}
                  isOpen={openCalendar === 'from'}
                  onClose={() => setOpenCalendar(null)}
                  onSelect={(date) => { setDraftStart(date); setError(null); }}
                  anchorRef={fromTriggerRef}
                />
              </div>
              <div className="date-range-picker__input-label">
                To
                <button
                  ref={toTriggerRef}
                  type="button"
                  className="date-range-picker__date-trigger"
                  onClick={() => setOpenCalendar((current) => (current === 'to' ? null : 'to'))}
                >
                  {formatDateLabel(draftEnd)}
                </button>
                <CalendarPopover
                  value={draftEnd}
                  max={todayDate()}
                  isOpen={openCalendar === 'to'}
                  onClose={() => setOpenCalendar(null)}
                  onSelect={(date) => { setDraftEnd(date); setError(null); }}
                  anchorRef={toTriggerRef}
                />
              </div>
            </div>
          )}

          {error && <p className="date-range-picker__error">{error}</p>}

          <div className="date-range-picker__actions">
            <button type="button" className="btn btn--secondary date-range-picker__cancel" onClick={() => setIsOpen(false)}>
              Cancel
            </button>
            <button type="button" className="btn btn--primary date-range-picker__apply" onClick={handleApply}>
              Apply
            </button>
          </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateRangePicker;
