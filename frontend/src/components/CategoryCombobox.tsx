import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { Check, ChevronDown, Plus } from 'lucide-react';
import type { InventoryItemCategory } from '../types/storeInventory';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import './SupplierCombobox.css';

interface CategoryComboboxProps {
  id: string;
  options: { value: InventoryItemCategory; label: string }[];
  value: InventoryItemCategory;
  onChange: (category: InventoryItemCategory) => void;
  ariaLabel?: string;
  // Leaves the item form and opens the Categories page, where a new category
  // gets its full details and store assignment. Omitted for Owner/Admin,
  // whose categories come entirely from Super Admin's assignment list -- the
  // "Add new category" option is then left out entirely.
  onRequestCreate?: () => void;
}

type ComboOption =
  | { kind: 'category'; value: InventoryItemCategory; label: string }
  | { kind: 'new' };

// Category picker for the inventory item form. Mirrors SupplierCombobox: the
// selected category is shown with a tick, and "Add new category" leaves the
// form for the Categories page rather than creating one in place, since a
// category's store assignment belongs there.
//
// Built on shadcn/Radix's Popover for positioning/outside-click-dismiss
// instead of a hand-rolled portal + visualViewport reposition effect. Still
// NOT built on Command/cmdk: this is a single editable text field that is
// simultaneously its own trigger and its own search box (typing directly
// into it filters in place), with its own Tab-closes / Enter-doesn't-submit
// keyboard handling -- cmdk's model assumes a separate always-mounted search
// input inside the popover content, which would change this field's actual
// interaction (click once to reveal a second, empty search box) rather than
// just its implementation. Popover's `PopoverAnchor` lets the input stay
// exactly where it already is in the DOM while `PopoverContent` still
// portals and positions the panel.
function CategoryCombobox({ id, options: categories, value, onChange, ariaLabel, onRequestCreate }: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxId = `${id}-listbox`;

  const selected = categories.find((c) => c.value === value) ?? (value ? { value, label: value } : null);

  const options = useMemo<ComboOption[]>(() => {
    const term = query.trim().toLowerCase();
    const matches = term ? categories.filter((c) => c.label.toLowerCase().includes(term)) : categories;

    const next: ComboOption[] = [];
    // With nothing typed there is no filtered list to steal focus from, so
    // this is the only time "Add new category" is offered.
    if (!term && onRequestCreate) next.push({ kind: 'new' });
    next.push(...matches.map((c) => ({ kind: 'category' as const, value: c.value, label: c.label })));
    return next;
  }, [categories, query, onRequestCreate]);

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
    if (option.kind === 'new') {
      close();
      onRequestCreate?.();
      return;
    }
    onChange(option.value);
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

  const inputValue = isOpen ? query : selected?.label ?? '';

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
            placeholder={isOpen && selected ? selected.label : 'Search a category'}
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
            <div className="supplier-combobox__empty">No matching categories</div>
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
                  <span>Add new category</span>
                </button>
              );
            }

            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={className}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => choose(option)}
              >
                <span className="supplier-combobox__check">{isSelected && <Check size={14} />}</span>
                {option.label}
              </button>
            );
          })}
        </PopoverContent>
      </div>
    </Popover>
  );
}

export default CategoryCombobox;
