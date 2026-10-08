import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Plus, X } from 'lucide-react';
import type { Supplier } from '../types/supplier';
import useDismissablePanel from '../hooks/useDismissablePanel';
import './SupplierCombobox.css';

const VIEWPORT_MARGIN = 8;

interface SupplierComboboxProps {
  id: string;
  suppliers: Supplier[];
  value: number | null;
  onChange: (supplierId: number | null) => void;
  // Saves a new supplier (or returns the existing one with that name) and
  // resolves with it. The caller is expected to add it to `suppliers` so it
  // shows up for future items too.
  onCreate: (name: string) => Promise<Supplier>;
  ariaLabel?: string;
}

type ComboOption =
  | { kind: 'none' }
  | { kind: 'supplier'; supplier: Supplier }
  | { kind: 'create'; name: string }
  | { kind: 'new' };

// Type-to-search supplier picker for the inventory item form. Filters the
// supplier directory as the user types and, when nothing matches the typed
// name exactly, offers "Add New Supplier" to create it in place -- so the
// user never has to leave the item form to set up a supplier first.
function SupplierCombobox({ id, suppliers, value, onChange, onCreate, ariaLabel }: SupplierComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlighted, setHighlighted] = useState(0);
  const [isCreating, setIsCreating] = useState(false);
  // "Add new supplier" collapses the list and turns the main textbox into a
  // name field for the new supplier.
  const [isAdding, setIsAdding] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;

  const selected = suppliers.find((supplier) => supplier.id === value) ?? null;

  const options = useMemo<ComboOption[]>(() => {
    const term = query.trim().toLowerCase();
    const active = suppliers.filter((supplier) => supplier.active);
    const matches = term ? active.filter((supplier) => supplier.name.toLowerCase().includes(term)) : active;
    const exactMatch = term !== '' && active.some((supplier) => supplier.name.trim().toLowerCase() === term);

    const next: ComboOption[] = [];
    // With nothing typed there is no typed-name create row, so offer an explicit way in.
    if (!term) next.push({ kind: 'new' });
    if (!term) next.push({ kind: 'none' });
    next.push(...matches.map((supplier) => ({ kind: 'supplier' as const, supplier })));
    if (term && !exactMatch) next.push({ kind: 'create', name: query.trim() });
    return next;
  }, [suppliers, query]);

  useEffect(() => {
    setHighlighted(0);
  }, [query, isOpen]);

  function open() {
    if (isOpen) return;
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (rect) setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    setQuery('');
    setCreateError(null);
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setQuery('');
  }

  // Same portal + flip-above-when-no-room positioning as SearchableSelect,
  // so a modal's scrolling body can't clip the list.
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

  async function choose(option: ComboOption) {
    if (option.kind === 'none') {
      onChange(null);
      close();
      return;
    }
    if (option.kind === 'new') {
      setCreateError(null);
      setIsOpen(false);
      setQuery('');
      setIsAdding(true);
      inputRef.current?.focus();
      return;
    }
    if (option.kind === 'supplier') {
      onChange(option.supplier.id);
      close();
      return;
    }
    setIsCreating(true);
    setCreateError(null);
    try {
      const created = await onCreate(option.name);
      onChange(created.id);
      setIsAdding(false);
      close();
      inputRef.current?.blur();
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to add supplier');
    } finally {
      setIsCreating(false);
    }
  }

  function cancelAdding() {
    setIsAdding(false);
    setQuery('');
    setCreateError(null);
  }

  function submitNew() {
    const name = query.trim();
    if (name && !isCreating) void choose({ kind: 'create', name });
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
      if (isOpen && !isCreating && options[highlighted]) void choose(options[highlighted]);
    } else if (event.key === 'Tab') {
      close();
    }
  }

  const inputValue = isOpen || isAdding ? query : selected?.name ?? '';

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
        value={inputValue}
        placeholder={isAdding ? 'Type the new supplier name' : isOpen && selected ? selected.name : 'Search or add a supplier'}
        onFocus={() => !isAdding && open()}
        onClick={() => !isAdding && open()}
        onChange={(event) => {
          if (!isOpen && !isAdding) open();
          setQuery(event.target.value);
        }}
        onKeyDown={handleKeyDown}
        disabled={isCreating}
      />
      {isAdding ? (
        <div className="supplier-combobox__adding-actions">
          <button
            type="button"
            className="supplier-combobox__icon-btn supplier-combobox__icon-btn--confirm"
            aria-label="Add supplier"
            disabled={isCreating || !query.trim()}
            onClick={submitNew}
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            className="supplier-combobox__icon-btn"
            aria-label="Cancel adding supplier"
            disabled={isCreating}
            onClick={cancelAdding}
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <ChevronDown size={16} className="supplier-combobox__chevron" aria-hidden="true" />
      )}
      {isAdding && createError && <div className="supplier-combobox__error">{createError}</div>}

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            id={listboxId}
            className="supplier-combobox__panel"
            role="listbox"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            {options.length === 0 && <div className="supplier-combobox__state">No suppliers yet. Type a name to add one.</div>}
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
                    onClick={() => void choose(option)}
                  >
                    <Plus size={14} />
                    <span>Add new supplier</span>
                  </button>
                );
              }

              if (option.kind === 'create') {
                return (
                  <button
                    key="create"
                    type="button"
                    role="option"
                    aria-selected={isHighlighted}
                    className={`${className} supplier-combobox__option--create`}
                    onMouseEnter={() => setHighlighted(index)}
                    onClick={() => void choose(option)}
                    disabled={isCreating}
                  >
                    <Plus size={14} />
                    <span>
                      {isCreating ? 'Adding supplier...' : <>Add New Supplier "<strong>{option.name}</strong>"</>}
                    </span>
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
                  onClick={() => void choose(option)}
                >
                  <span className="supplier-combobox__check">{isSelected && <Check size={14} />}</span>
                  {option.kind === 'none' ? 'No preferred supplier' : option.supplier.name}
                </button>
              );
            })}
            {createError && <div className="supplier-combobox__state supplier-combobox__state--error">{createError}</div>}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default SupplierCombobox;
