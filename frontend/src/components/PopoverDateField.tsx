import { useRef, useState } from 'react';
import { Calendar } from 'lucide-react';
import { useMediaQuery } from '../hooks/useMediaQuery';
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

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Phones and vertical tablets get the same CalendarPopover the Daily
// Checklist's date nav uses, rather than the OS-drawn <input type="date">
// overlay; desktop keeps the native input exactly as it was.
function PopoverDateField({ id, value, onChange, min, max, placeholder = 'Select date', clearable = false }: PopoverDateFieldProps) {
  const useCustomPicker = useMediaQuery('(max-width: 1024px)');
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!useCustomPicker) {
    return (
      <input id={id} type="date" className="input" value={value} min={min} max={max}
        onChange={(event) => onChange(event.target.value)} />
    );
  }

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
