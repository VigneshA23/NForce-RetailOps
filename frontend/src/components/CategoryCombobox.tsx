import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus } from 'lucide-react';
import type { InventoryItemCategory } from '../types/storeInventory';
import useDismissablePanel from '../hooks/useDismissablePanel';
import './SupplierCombobox.css';

const VIEWPORT_MARGIN = 8;

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
function CategoryCombobox({ id, options: categories, value, onChange, ariaLabel, onRequestCreate }: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
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
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setQuery('');
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setQuery('');
  }

  function repositionPanel() {
    const wrapper = wrapperRef.current;
    const panel = panelRef.current;
    if (!wrapper || !panel) return;
    const wrapperRect = wrapper.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    let top = wrapperRect.bottom + 4;
    if (top + panelRect.height > viewportHeight - VIEWPORT_MARGIN) {
      top = wrapperRect.top - panelRect.height - 4;
    }
    top = Math.max(VIEWPORT_MARGIN, top);
    setPosition((current) => (top !== current.top ? { ...current, top } : current));
  }

  useLayoutEffect(() => {
    if (isOpen) repositionPanel();
  }, [isOpen, options.length]);

  useEffect(() => {
    if (!isOpen || !window.visualViewport) return;
    const viewport = window.visualViewport;
    viewport.addEventListener('resize', repositionPanel);
    return () => viewport.removeEventListener('resize', repositionPanel);
  }, [isOpen]);

  useDismissablePanel({ isOpen, onClose: close, refs: [wrapperRef, panelRef] });

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
    <div className="supplier-combobox" ref={wrapperRef}>
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
      <ChevronDown size={16} className="supplier-combobox__chevron" aria-hidden="true" />

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            id={listboxId}
            className="supplier-combobox__panel"
            role="listbox"
            style={{ top: position.top, left: position.left, width: position.width }}
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
          </div>,
          document.body,
        )}
    </div>
  );
}

export default CategoryCombobox;
