import { useMemo, useState } from 'react';
import { Check, ChevronDown, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
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

// Built on shadcn/Radix's Popover + Command (cmdk) instead of a hand-rolled
// portal -- viewport flipping/clamping (including the on-screen-keyboard
// case this used to special-case via visualViewport) comes from Radix's
// Popper, and arrow-key navigation through options comes for free from cmdk,
// which this never had before. `shouldFilter={false}` on Command keeps this
// component's own exact-substring filter (`filteredOptions` below) instead
// of switching to cmdk's fuzzy command-score matching, so search behavior is
// unchanged.
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

  function setOpen(next: boolean) {
    setIsOpen(next);
    if (!next) setQuery('');
  }

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allActive = allOption?.selected ?? false;

  function toggleOption(optionId: number) {
    if (multiple) {
      // allActive ("applies to all") deliberately blocks individual picks
      // here -- it must be toggled off via allOption first (CategoryFormModal
      // and friends). A single-select store/owner filter has no such "applies
      // to everything" flag to guard: picking a specific option should always
      // work and simply supersedes "All", same as clicking any other option.
      if (allActive) return;
      const next = selectedSet.has(optionId)
        ? selectedIds.filter((existing) => existing !== optionId)
        : [...selectedIds, optionId];
      onChange(next);
    } else {
      onChange([optionId]);
      setOpen(false);
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
    <div className="searchable-select">
      <Popover open={isOpen && !disabled} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            id={id}
            className={`searchable-select__trigger${isOpen ? ' searchable-select__trigger--open' : ''}`}
            disabled={disabled || isLoading}
          >
            <span className={selectedIds.length === 0 && !allActive ? 'searchable-select__placeholder' : undefined}>
              {isLoading ? 'Loading...' : triggerLabel}
            </span>
            <ChevronDown size={16} />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={4}
          collisionPadding={8}
          className="w-(--radix-popover-trigger-width) p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput placeholder="Search..." value={query} onValueChange={setQuery} />
            <CommandList className="max-h-[220px] py-1">
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
                      <CommandItem
                        className="searchable-select__option"
                        onSelect={() => {
                          const turningOn = !allActive;
                          allOption.onToggle();
                          // Unticking "All" leaves the panel open so the user can pick stores.
                          if (turningOn) setOpen(false);
                        }}
                      >
                        <span className={`searchable-select__box${allActive ? ' searchable-select__box--checked' : ''}`}>
                          {allActive && <Check size={12} />}
                        </span>
                        {allOption.label}
                      </CommandItem>
                      <div className="searchable-select__divider" />
                    </>
                  )}
                  <CommandEmpty className="searchable-select__state">No matches</CommandEmpty>
                  {filteredOptions.map((option) => {
                    // "Every row ticked" only makes sense for the multi-select
                    // "applies to all" flag; a single-select All/one filter has
                    // nothing selected individually while "All" is active.
                    const checked = (multiple && allActive) || selectedSet.has(option.id);
                    const optionDisabled = multiple && allActive;
                    return (
                      <CommandItem
                        key={option.id}
                        value={`${option.id}`}
                        disabled={optionDisabled}
                        className="searchable-select__option"
                        onSelect={() => toggleOption(option.id)}
                      >
                        <span className={`searchable-select__box${checked ? ' searchable-select__box--checked' : ''}${multiple ? '' : ' searchable-select__box--round'}`}>
                          {checked && <Check size={12} />}
                        </span>
                        <span>
                          {option.label}
                          {option.sublabel && <span className="searchable-select__sublabel"> · {option.sublabel}</span>}
                        </span>
                      </CommandItem>
                    );
                  })}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

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
    </div>
  );
}

export default SearchableSelect;
