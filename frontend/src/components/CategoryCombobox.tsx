import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import { normalizeCategoryName, type InventoryItemCategory } from '../types/storeInventory';
import useDismissablePanel from '../hooks/useDismissablePanel';
import './SupplierCombobox.css';

const VIEWPORT_MARGIN = 8;
const MAX_CATEGORY_LENGTH = 40;

interface CategoryComboboxProps {
  id: string;
  options: { value: InventoryItemCategory; label: string }[];
  value: InventoryItemCategory;
  onChange: (category: InventoryItemCategory) => void;
  ariaLabel?: string;
}

type ComboOption =
  | { kind: 'category'; value: InventoryItemCategory; label: string }
  | { kind: 'create'; name: string }
  | { kind: 'new' };

// Category picker for the inventory item form. Mirrors SupplierCombobox: the
// selected category is shown with a tick, and "Add new category" turns the
// same textbox into a name field. A new category has no table of its own --
// it is saved with the item and offered again once an item uses it.
function CategoryCombobox({ id, options: categories, value, onChange, ariaLabel }: CategoryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;

  const selected = categories.find((c) => c.value === value) ?? (value ? { value, label: value } : null);

  const options = useMemo<ComboOption[]>(() => {
    const term = query.trim().toLowerCase();
    const matches = term ? categories.filter((c) => c.label.toLowerCase().includes(term)) : categories;
    const exactMatch = term !== '' && categories.some((c) => c.label.toLowerCase() === term || c.value.toLowerCase() === term);

    const next: ComboOption[] = matches.map((c) => ({ kind: 'category' as const, value: c.value, label: c.label }));
    if (term && !exactMatch) next.push({ kind: 'create', name: query.trim() });
    if (!term) next.push({ kind: 'new' });
    return next;
  }, [categories, query]);

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
      setIsOpen(false);
      setQuery('');
      setIsAdding(true);
      inputRef.current?.focus();
      return;
    }
    if (option.kind === 'category') {
      onChange(option.value);
      close();
      return;
    }
    onChange(normalizeCategoryName(option.name));
    setIsAdding(false);
    close();
    inputRef.current?.blur();
  }

  function cancelAdding() {
    setIsAdding(false);
    setQuery('');
  }

  function submitNew() {
    const name = query.trim();
    if (name) choose({ kind: 'create', name });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (isAdding) {
      if (event.key === 'Enter') {
        event.preventDefault();
        submitNew();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelAdding();
      }
      return;
    }
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

  const inputValue = isOpen || isAdding ? query : selected?.label ?? '';

  return (
    <div className="supplier-combobox" ref={wrapperRef}>
      <input
        ref={inputRef}
        id={id}
        className={`input supplier-combobox__input${isAdding ? ' supplier-combobox__input--adding' : ''}`}
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        maxLength={MAX_CATEGORY_LENGTH}
        value={inputValue}
        placeholder={isAdding ? 'Type the new category name' : isOpen && selected ? selected.label : 'Search or add a category'}
        onFocus={() => !isAdding && open()}
        onClick={() => !isAdding && open()}
        onChange={(event) => {
          if (!isOpen && !isAdding) open();
          setQuery(event.target.value);
        }}
        onKeyDown={handleKeyDown}
      />
      {isAdding ? (
        <div className="supplier-combobox__adding-actions">
          <button
            type="button"
            className="supplier-combobox__icon-btn supplier-combobox__icon-btn--confirm"
            aria-label="Add category"
            disabled={!query.trim()}
            onClick={submitNew}
          >
            <Check size={16} />
          </button>
          <button type="button" className="supplier-combobox__icon-btn" aria-label="Cancel adding category" onClick={cancelAdding}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <ChevronDown size={16} className="supplier-combobox__chevron" aria-hidden="true" />
      )}

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            id={listboxId}
            className="supplier-combobox__panel"
            role="listbox"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {options.map((option, index) => {
              const isHighlighted = index === highlighted;
              const className = `supplier-combobox__option${isHighlighted ? ' supplier-combobox__option--highlighted' : ''}`;

              if (option.kind === 'new' || option.kind === 'create') {
                return (
                  <button
                    key={option.kind}
                    type="button"
                    role="option"
                    aria-selected={isHighlighted}
                    className={`${className} supplier-combobox__option--create`}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => choose(option)}
                  >
                    <Plus size={14} />
                    <span>
                      {option.kind === 'new' ? 'Add new category' : <>Add New Category "<strong>{option.name}</strong>"</>}
                    </span>
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
