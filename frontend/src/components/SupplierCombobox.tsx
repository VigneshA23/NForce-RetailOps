import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import type { Supplier } from '../types/supplier';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import './SupplierCombobox.css';

interface SupplierComboboxProps {
  id: string;
  suppliers: Supplier[];
  value: number | null;
  onChange: (supplierId: number | null) => void;
  // Leaves the item form and opens the Suppliers page, where a new supplier
  // gets its full details and store assignment, same as the Categories field
  // below. Omitted where the caller has read-only supplier access
  // (Owner/Admin) -- the "Add new supplier" option is then left out entirely.
  onRequestCreate?: () => void;
  ariaLabel?: string;
  // True when this field is seeded from an item that already exists (editing,
  // not creating) -- a null `value` there is the item's actual, already-saved
  // "no preferred supplier" answer, not an unanswered field, so it should
  // read as the explicit answer from the moment the form opens rather than
  // only after the user re-picks it by hand.
  isEditingExisting?: boolean;
}

type ComboOption =
  | { kind: 'none' }
  | { kind: 'supplier'; supplier: Supplier }
  | { kind: 'new' };

// Type-to-search supplier picker for the inventory item form. Filters the
// supplier directory (already scoped to this store by the caller) as the
// user types; "Add new supplier" leaves the form for the Suppliers page
// rather than creating one in place, since a supplier's store assignment
// belongs there.
//
// Built on shadcn/Radix's Popover for positioning/outside-click-dismiss
// instead of a hand-rolled portal + visualViewport reposition effect -- see
// CategoryCombobox.tsx (same pattern, same reasoning for not using
// Command/cmdk here: this field is its own trigger and its own search box).
function SupplierCombobox({ id, suppliers, value, onChange, onRequestCreate, ariaLabel, isEditingExisting }: SupplierComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  // Distinguishes "never touched, still null" (shows the generic select
  // placeholder) from "explicitly picked No preferred supplier" (shows that
  // as the field's value) -- both are `value === null`, but only the second
  // should read as an actual answer.
  const [explicitlyNone, setExplicitlyNone] = useState(() => !!isEditingExisting && value === null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  const selected = suppliers.find((supplier) => supplier.id === value) ?? null;

  const options = useMemo<ComboOption[]>(() => {
    const term = query.trim().toLowerCase();
    const active = suppliers.filter((supplier) => supplier.active);
    const matches = term ? active.filter((supplier) => supplier.name.toLowerCase().includes(term)) : active;

    const next: ComboOption[] = [];
    // With nothing typed there is no filtered list to steal focus from, so
    // this is the only time "Add new supplier" is offered.
    if (!term && onRequestCreate) next.push({ kind: 'new' });
    if (!term) next.push({ kind: 'none' });
    next.push(...matches.map((supplier) => ({ kind: 'supplier' as const, supplier })));
    return next;
  }, [suppliers, query, onRequestCreate]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, isOpen]);

  function open() {
    if (isOpen) return;
    setQuery('');
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setQuery('');
  }

  function choose(option: ComboOption) {
    if (option.kind === 'none') {
      onChange(null);
      setExplicitlyNone(true);
      close();
      return;
    }
    if (option.kind === 'new') {
      close();
      onRequestCreate?.();
      return;
    }
    onChange(option.supplier.id);
    close();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) open();
      else setHighlighted((current) => Math.min(current + 1, options.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlighted((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      // Never let Enter here submit the surrounding item form.
      event.preventDefault();
      if (isOpen && options[highlighted]) choose(options[highlighted]);
    } else if (event.key === 'Tab') {
      close();
    }
  }

  // Closed after explicitly picking "No preferred supplier" reads as that
  // answer, not a blank field -- but closed with nothing ever picked (the
  // default) still shows the generic select placeholder below, not this.
  const noSupplierLabel = 'No preferred supplier';
  const selectedLabel = selected ? selected.name : explicitlyNone ? noSupplierLabel : '';
  const inputValue = isOpen ? query : selectedLabel;
  const searchPlaceholder = onRequestCreate ? 'Select or add a supplier' : 'Select supplier';

  return (
    <Popover open={isOpen} onOpenChange={(next) => (next ? open() : close())}>
      <div className="supplier-combobox">
        <PopoverAnchor asChild>
          <input
            ref={inputRef}
            id={id}
            className="input supplier-combobox__input"
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-autocomplete="list"
            autoComplete="off"
            value={inputValue}
            placeholder={selected ? selected.name : searchPlaceholder}
            onFocus={open}
            onClick={open}
            onChange={(event) => {
              if (!isOpen) open();
              setQuery(event.target.value);
            }}
            onKeyDown={handleKeyDown}
          />
        </PopoverAnchor>
        <ChevronDown size={16} className="supplier-combobox__chevron" aria-hidden="true" />

        <PopoverContent
          id={listboxId}
          role="listbox"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          onOpenAutoFocus={(event) => event.preventDefault()}
          className="w-(--radix-popper-anchor-width) max-h-[220px] overflow-y-auto p-1"
        >
          {options.length === 0 && (
            <div className="supplier-combobox__state">No suppliers match.</div>
          )}
          {options.map((option, index) => {
            const isHighlighted = index === highlighted;
            const className = `supplier-combobox__option${isHighlighted ? ' supplier-combobox__option--highlighted' : ''}`;

            if (option.kind === 'new') {
              return (
                <button
                  key="new"
                  type="button"
                  role="option"
                  aria-selected={isHighlighted}
                  className={`${className} supplier-combobox__option--create`}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => choose(option)}
                >
                  <Plus size={14} />
                  <span>Add new supplier</span>
                </button>
              );
            }

            const isSelected = option.kind === 'none' ? value == null : option.supplier.id === value;
            return (
              <button
                key={option.kind === 'none' ? 'none' : option.supplier.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`${className}${option.kind === 'none' ? ' supplier-combobox__option--muted' : ''}`}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(option)}
              >
                <span className="supplier-combobox__check">{isSelected && <Check size={14} />}</span>
                {option.kind === 'none' ? 'No preferred supplier' : option.supplier.name}
              </button>
            );
          })}
        </PopoverContent>
      </div>
    </Popover>
  );
}

export default SupplierCombobox;
