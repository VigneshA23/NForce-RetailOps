import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import './SearchableSelect.css';

const VIEWPORT_MARGIN = 8;

export interface SearchableSelectOption {
  id: number;
  label: string;
  sublabel?: string;
}

export interface SearchableSelectAllOption {
  label: string;
  selected: boolean;
  onToggle: () => void;
}

interface SearchableSelectProps {
  id: string;
  options: SearchableSelectOption[];
  multiple?: boolean;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  placeholder: string;
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  emptyMessage?: string;
  emptyAction?: { label: string; onClick: () => void };
  allOption?: SearchableSelectAllOption;
  disabled?: boolean;
}

function SearchableSelect({
  id,
  options,
  multiple = false,
  selectedIds,
  onChange,
  placeholder,
  isLoading = false,
  error = null,
  onRetry,
  emptyMessage = 'No options available',
  emptyAction,
  allOption,
  disabled = false,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
    setIsOpen(true);
  }

  // Same fix as MultiSelect/RowActionsMenu: this panel used to render inline
  // via `position: absolute`, so a modal's `overflow-y: auto` body clipped it
  // whenever the trigger sat anywhere but the very top of the form. Portal it
  // to <body> and measure it post-render, flipping above the trigger if
  // opening below would push it past the bottom of the viewport.
  //
  // Uses visualViewport's height, not window.innerHeight -- this panel
  // autofocuses a search input on open, which raises the on-screen keyboard
  // on a real phone. iOS Safari shrinks visualViewport (not the layout
  // viewport) when that happens and does NOT fire a window 'resize' event
  // for it, so a flip computed off window.innerHeight stays sized for the
  // pre-keyboard viewport and the panel ends up rendered under the keyboard.
  function repositionPanel() {
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;

    let top = triggerRect.bottom + 4;
    if (top + panelRect.height > viewportHeight - VIEWPORT_MARGIN) {
      top = triggerRect.top - panelRect.height - 4;
    }
    top = Math.max(VIEWPORT_MARGIN, top);

    setPosition((current) => (top !== current.top ? { ...current, top } : current));
  }

  useLayoutEffect(() => {
    if (!isOpen) return;
    repositionPanel();
  }, [isOpen]);

  // Re-run the same flip logic when the on-screen keyboard opens/closes,
  // instead of just closing the panel -- visualViewport is what actually
  // changes size in that case, and only some browsers also fire a window
  // 'resize' for it.
  useEffect(() => {
    if (!isOpen || !window.visualViewport) return;
    const viewport = window.visualViewport;
    viewport.addEventListener('resize', repositionPanel);
    return () => viewport.removeEventListener('resize', repositionPanel);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      const clickedWrapper = wrapperRef.current?.contains(target);
      const clickedPanel = panelRef.current?.contains(target);
      if (!clickedWrapper && !clickedPanel) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        // Capture phase + stopPropagation: when this dropdown is rendered
        // inside a Modal, Modal's own bubble-phase Escape listener on
        // `document` would otherwise also fire and close the modal underneath us.
        event.stopPropagation();
        setIsOpen(false);
      }
    }
    // Simplest robust fix for a portal-rendered panel: close on scroll rather
    // than tracking the trigger's position continuously (relevant here since
    // the trigger typically lives inside a scrollable modal body).
    function handleScrollOrResize() {
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
      window.clearTimeout(focusTimer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) setQuery('');
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allActive = allOption?.selected ?? false;

  function toggleOption(optionId: number) {
    if (allActive) return;
    if (multiple) {
      const next = selectedSet.has(optionId)
        ? selectedIds.filter((existing) => existing !== optionId)
        : [...selectedIds, optionId];
      onChange(next);
    } else {
      onChange([optionId]);
      setIsOpen(false);
    }
  }

  function removeChip(optionId: number, event: React.MouseEvent) {
    event.stopPropagation();
    onChange(selectedIds.filter((existing) => existing !== optionId));
  }

  const triggerLabel = useMemo(() => {
    if (allActive) return allOption!.label;
    if (selectedIds.length === 0) return placeholder;
    if (selectedIds.length === 1) {
      return options.find((option) => option.id === selectedIds[0])?.label ?? placeholder;
    }
    return `${selectedIds.length} selected`;
  }, [allActive, allOption, options, placeholder, selectedIds]);

  const selectedChips = multiple && !allActive
    ? selectedIds
        .map((selectedId) => options.find((option) => option.id === selectedId))
        .filter((option): option is SearchableSelectOption => Boolean(option))
    : [];

  return (
    <div className="searchable-select" ref={wrapperRef}>
      <button
        ref={triggerRef}
        type="button"
        id={id}
        className={`searchable-select__trigger${isOpen ? ' searchable-select__trigger--open' : ''}`}
        onClick={() => {
          if (disabled) return;
          isOpen ? setIsOpen(false) : openPanel();
        }}
        disabled={disabled || isLoading}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={selectedIds.length === 0 && !allActive ? 'searchable-select__placeholder' : undefined}>
          {isLoading ? 'Loading...' : triggerLabel}
        </span>
        <ChevronDown size={16} />
      </button>

      {selectedChips.length > 0 && (
        <div className="searchable-select__chips">
          {selectedChips.map((option) => (
            <span key={option.id} className="searchable-select__chip">
              {option.label}
              <button type="button" aria-label={`Remove ${option.label}`} onClick={(event) => removeChip(option.id, event)}>
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {isOpen &&
        !disabled &&
        createPortal(
          <div
            ref={panelRef}
            className="searchable-select__panel"
            role="listbox"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <label className="searchable-select__search">
              <Search size={14} />
              <input
                ref={searchRef}
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search..."
              />
            </label>

            <div className="searchable-select__options">
              {error ? (
                <div className="searchable-select__state searchable-select__state--error">
                  {error}
                  {onRetry && (
                    <button type="button" className="btn btn--secondary" onClick={onRetry}>
                      Retry
                    </button>
                  )}
                </div>
              ) : options.length === 0 ? (
                <div className="searchable-select__state">
                  {emptyMessage}
                  {emptyAction && (
                    <button type="button" className="btn btn--secondary" onClick={emptyAction.onClick}>
                      {emptyAction.label}
                    </button>
                  )}
                </div>
              ) : (
                <>
                  {allOption && (
                    <>
                      <button
                        type="button"
                        className="searchable-select__option"
                        onClick={() => {
                          allOption.onToggle();
                          setIsOpen(false);
                        }}
                      >
                        <span className={`searchable-select__box${allActive ? ' searchable-select__box--checked' : ''}`}>
                          {allActive && <Check size={12} />}
                        </span>
                        {allOption.label}
                      </button>
                      <div className="searchable-select__divider" />
                    </>
                  )}
                  {filteredOptions.length === 0 ? (
                    <div className="searchable-select__state">No matches</div>
                  ) : (
                    filteredOptions.map((option) => {
                      const checked = allActive || selectedSet.has(option.id);
                      return (
                        <button
                          type="button"
                          key={option.id}
                          className="searchable-select__option"
                          disabled={allActive}
                          onClick={() => toggleOption(option.id)}
                        >
                          <span className={`searchable-select__box${checked ? ' searchable-select__box--checked' : ''}${multiple ? '' : ' searchable-select__box--round'}`}>
                            {checked && <Check size={12} />}
                          </span>
                          <span>
                            {option.label}
                            {option.sublabel && <span className="searchable-select__sublabel"> · {option.sublabel}</span>}
                          </span>
                        </button>
                      );
                    })
                  )}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default SearchableSelect;
