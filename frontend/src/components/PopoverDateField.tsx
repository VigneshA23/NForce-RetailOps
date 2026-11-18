import { useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import CalendarPopover from './CalendarPopover';
import './PopoverDateField.css';

interface PopoverDateFieldProps {
  id: string;
  // YYYY-MM-DD, or '' when unset.
  value: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  // Offers a "Clear" shortcut in the popover -- for optional dates only.
  clearable?: boolean;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

// Fixed locale so the field reads "18 Nov 2026" like the rest of the app,
// regardless of the browser/OS locale.
function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Every viewport uses the same themed CalendarPopover the Daily Checklist's
// date nav uses, rather than the OS-drawn <input type="date"> picker (which
// ignores the app theme and follows the OS locale's date format).
function PopoverDateField({ id, value, onChange, min, max, placeholder = 'Select date', clearable = false }: PopoverDateFieldProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        className="input popover-date-field"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={value ? undefined : 'popover-date-field__placeholder'}>
          {value ? formatDate(value) : placeholder}
        </span>
        <Calendar size={14} aria-hidden="true" />
      </button>
      <CalendarPopover
        value={value || todayKey()}
        min={min}
        max={max}
        isOpen={open}
        onClose={() => setOpen(false)}
        onSelect={onChange}
        onClear={clearable && value ? () => onChange('') : undefined}
        onToday={() => onChange(todayKey())}
        anchorRef={triggerRef}
      />
    </>
  );
}

export default PopoverDateField;
