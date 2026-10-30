import { useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import SearchInput from './SearchInput';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import './MultiSelect.css';

export interface MultiSelectOption {
  id: number;
  label: string;
}

interface MultiSelectProps {
  id?: string;
  options: MultiSelectOption[];
  value: number[];
  onChange: (ids: number[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  // When set and every option is selected, the trigger shows this single chip
  // (removing it clears the selection) instead of one chip per option.
  allSelectedLabel?: string;
}

// Built on shadcn/Radix's Popover instead of a hand-rolled portal -- see
// SearchableSelect.tsx for the same pattern, minus cmdk/Command here: cmdk's
// CommandItem hardcodes its own `role="option"`/`aria-selected` to mean
// "currently keyboard-highlighted", not "currently selected", and that can't
// be overridden via props (its render spreads caller props first, then sets
// those two attributes itself). That's fine for a single-pick combobox but
// wrong for a persistent multi-select checklist, so the option list below
// stays hand-rolled (exactly as before) with `aria-selected` genuinely
// reflecting `value`, while Popover still replaces all the manual
// portal/reposition/dismiss math.
function MultiSelect({
  id,
  options,
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  allSelectedLabel,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  function setOpen(next: boolean) {
    setIsOpen(next);
    if (next) setQuery('');
  }

  function toggleOpen() {
    setOpen(!isOpen);
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleOpen();
    }
  }

  function toggleOption(optionId: number) {
    if (value.includes(optionId)) {
      onChange(value.filter((selectedId) => selectedId !== optionId));
    } else {
      onChange([...value, optionId]);
    }
  }

  function removeOption(optionId: number, event: ReactMouseEvent) {
    event.stopPropagation();
    onChange(value.filter((selectedId) => selectedId !== optionId));
  }

  const selectedOptions = options.filter((option) => value.includes(option.id));
  const showAllChip = !!allSelectedLabel && options.length > 1 && selectedOptions.length === options.length;
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(query.trim().toLowerCase()),
  );

  return (
    <Popover open={isOpen} onOpenChange={setOpen}>
      <div className="multi-select">
        <PopoverTrigger asChild>
          <div
            id={id}
            className="multi-select__trigger"
            role="combobox"
            tabIndex={0}
            aria-haspopup="listbox"
            aria-expanded={isOpen}
            onClick={toggleOpen}
            onKeyDown={handleTriggerKeyDown}
          >
            {selectedOptions.length === 0 ? (
              <span className="multi-select__placeholder">{placeholder}</span>
            ) : (
              <span className="multi-select__chips">
                {showAllChip && (
                  <span className="badge badge--outline multi-select__chip">
                    {allSelectedLabel}
                    <button
                      type="button"
                      className="multi-select__chip-remove"
                      aria-label={`Remove ${allSelectedLabel}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        onChange([]);
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
                {!showAllChip && selectedOptions.map((option) => (
                  <span key={option.id} className="badge badge--outline multi-select__chip">
                    {option.label}
                    <button
                      type="button"
                      className="multi-select__chip-remove"
                      aria-label={`Remove ${option.label}`}
                      onClick={(event) => removeOption(option.id, event)}
                    >
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </span>
            )}
            <ChevronDown size={16} className="multi-select__chevron" />
          </div>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <div className="multi-select__search">
            <SearchInput variant="card" value={query} onChange={setQuery} placeholder={searchPlaceholder} />
          </div>
          <div className="multi-select__options" role="listbox" aria-multiselectable="true">
            {filteredOptions.length === 0 ? (
              <div className="multi-select__empty">No stores found</div>
            ) : (
              filteredOptions.map((option) => {
                const isSelected = value.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className={`multi-select__option${isSelected ? ' multi-select__option--selected' : ''}`}
                    onClick={() => toggleOption(option.id)}
                  >
                    <span className="multi-select__option-check">{isSelected && <Check size={14} />}</span>
                    {option.label}
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </div>
    </Popover>
  );
}

export default MultiSelect;
