import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './StoreFilterDropdown.css';

export type StoreCompletionStatus = 'completed' | 'in-progress' | 'unscheduled';

export interface StoreFilterOption {
  id: number;
  name: string;
  status: StoreCompletionStatus;
}

interface StoreFilterDropdownProps {
  options: StoreFilterOption[];
  // Empty selection means "All Stores".
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

const STATUS_LABEL: Record<StoreCompletionStatus, string> = {
  completed: 'Completed',
  'in-progress': 'In Progress',
  unscheduled: 'Unscheduled',
};

function StoreFilterDropdown({ options, selectedIds, onChange }: StoreFilterDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) {
      setPosition({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 220) });
    }
    setIsOpen(true);
  }

  // Same fix as MultiSelect: flip the panel above the trigger if opening
  // below would push it past the bottom of the viewport.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelRect = panel.getBoundingClientRect();
    const margin = 8;

    let top = triggerRect.bottom + 4;
    if (top + panelRect.height > window.innerHeight - margin) {
      top = triggerRect.top - panelRect.height - 4;
    }
    top = Math.max(margin, top);

    if (top !== position.top) {
      setPosition((current) => ({ ...current, top }));
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setIsOpen(false);
      }
    }

    function handleScrollOrResize() {
      setIsOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  function toggleOpen() {
    isOpen ? setIsOpen(false) : openPanel();
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleOpen();
    }
  }

  function toggleOption(optionId: number) {
    if (selectedIds.includes(optionId)) {
      onChange(selectedIds.filter((id) => id !== optionId));
    } else {
      onChange([...selectedIds, optionId]);
    }
  }

  const isAllSelected = selectedIds.length === 0;
  const selectedNames = options.filter((option) => selectedIds.includes(option.id)).map((option) => option.name);
  const triggerLabel = isAllSelected
    ? 'All Stores'
    : selectedNames.length === 1
      ? selectedNames[0]
      : `${selectedNames.length} stores selected`;

  return (
    <div className="store-filter">
      <div
        ref={triggerRef}
        className="store-filter__trigger"
        role="combobox"
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label="Filter stores"
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="store-filter__label">{triggerLabel}</span>
        <ChevronDown size={14} className="store-filter__chevron" />
      </div>
      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            className="store-filter__panel"
            role="listbox"
            aria-multiselectable="true"
            style={{ top: position.top, left: position.left, width: position.width }}
          >
            <button
              type="button"
              role="option"
              aria-selected={isAllSelected}
              className={`store-filter__option store-filter__option--all${isAllSelected ? ' store-filter__option--selected' : ''}`}
              onClick={() => onChange([])}
            >
              <span className="store-filter__option-check">{isAllSelected && <Check size={14} />}</span>
              All Stores
            </button>
            <div className="store-filter__divider" />
            {options.map((option) => {
              const isSelected = selectedIds.includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`store-filter__option${isSelected ? ' store-filter__option--selected' : ''}`}
                  onClick={() => toggleOption(option.id)}
                >
                  <span className="store-filter__option-check">{isSelected && <Check size={14} />}</span>
                  <span
                    className={`store-filter__status-dot store-filter__status-dot--${option.status}`}
                    aria-hidden="true"
                  />
                  <span className="store-filter__option-name">{option.name}</span>
                  <span className="store-filter__option-status">{STATUS_LABEL[option.status]}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}

export default StoreFilterDropdown;
