import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import './SearchableSelect.css';

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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    const focusTimer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
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
        type="button"
        id={id}
        className={`searchable-select__trigger${isOpen ? ' searchable-select__trigger--open' : ''}`}
        onClick={() => !disabled && setIsOpen((open) => !open)}
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

      {isOpen && !disabled && (
        <div className="searchable-select__panel" role="listbox">
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
        </div>
      )}
    </div>
  );
}

export default SearchableSelect;
